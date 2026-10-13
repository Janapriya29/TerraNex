import os
import json
import sys
from datetime import datetime
from pathlib import Path
from bson import ObjectId

BACKUP_DIR = Path(r"C:\Users\janap\Desktop\TerraNex-GitHub\backups\host_mongodb_backup_20261013_185051")

def parse_doc(doc):
    """Convert extended JSON formats ($oid, $date) back to Python types."""
    parsed = {}
    for k, v in doc.items():
        if isinstance(v, dict):
            if "$oid" in v:
                parsed[k] = ObjectId(v["$oid"])
            elif "$date" in v:
                try:
                    parsed[k] = datetime.fromisoformat(v["$date"].replace("Z", "+00:00"))
                except Exception:
                    parsed[k] = v["$date"]
            else:
                parsed[k] = parse_doc(v)
        elif isinstance(v, list):
            parsed[k] = [parse_doc(item) if isinstance(item, dict) else item for item in v]
        else:
            parsed[k] = v
    return parsed

def restore(target_mongo_url):
    try:
        from pymongo import MongoClient
    except ImportError:
        print("Error: pymongo is not installed in the environment.")
        sys.exit(1)

    print(f"Connecting to target MongoDB...")
    client = MongoClient(target_mongo_url, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client["TerraNex"]
    print("Connected successfully to database 'TerraNex'.")

    manifest_path = BACKUP_DIR / "manifest.json"
    if not manifest_path.exists():
        print(f"Error: Manifest not found at {manifest_path}")
        sys.exit(1)

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    print("\nVerified Backup Manifest:")
    print(json.dumps(manifest, indent=2))

    collections = ["users", "crop_history", "disease_history"]
    for coll_name in collections:
        file_path = BACKUP_DIR / f"{coll_name}.json"
        if not file_path.exists():
            print(f"Skipping {coll_name}: file not found.")
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        coll = db[coll_name]
        existing_count = coll.count_documents({})
        print(f"\nProcessing '{coll_name}' ({len(data)} records in backup, {existing_count} currently in DB)...")

        inserted = 0
        updated = 0
        for raw_doc in data:
            doc = parse_doc(raw_doc)
            doc_id = doc.get("_id")
            if doc_id:
                res = coll.update_one({"_id": doc_id}, {"$set": doc}, upsert=True)
                if res.upserted_id:
                    inserted += 1
                elif res.modified_count:
                    updated += 1

        print(f"Result for '{coll_name}': {inserted} newly added, {updated} updated, Total now: {coll.count_documents({})}")

    print("\nRestore process completed successfully and verified.")

if __name__ == "__main__":
    url = os.getenv("TARGET_MONGODB_URL")
    if not url:
        print("Usage: Pass TARGET_MONGODB_URL as environment variable.")
        print("Example: TARGET_MONGODB_URL='mongodb+srv://user:pass@cluster.mongodb.net/TerraNex' python restore_to_atlas.py")
        sys.exit(0)
    restore(url)
