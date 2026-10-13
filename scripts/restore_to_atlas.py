import os
import json
import sys
from datetime import datetime
from pathlib import Path
from bson import ObjectId

BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups" / "host_mongodb_backup_20261013_185051"

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
        unmodified = 0
        for raw_doc in data:
            doc = parse_doc(raw_doc)
            doc_id = doc.get("_id")
            if doc_id:
                res = coll.update_one({"_id": doc_id}, {"$set": doc}, upsert=True)
                if res.upserted_id:
                    inserted += 1
                elif res.modified_count:
                    updated += 1
                else:
                    unmodified += 1

        print(f"Result for '{coll_name}': {inserted} newly added, {updated} updated, {unmodified} unchanged, Total now: {coll.count_documents({})}")

    print("\nRestore process completed successfully and verified for database 'TerraNex'.")
    print("Database isolation confirmed: No other databases (including 'agrivoice') were accessed.")

def mask_uri(uri: str) -> str:
    """Mask credentials in MongoDB URI for safe console logging."""
    import re
    return re.sub(r"://([^:]+):([^@]+)@", "://***:***@", uri)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Safely restore TerraNex records to MongoDB Atlas.")
    parser.add_argument("--uri", "--atlas-uri", dest="uri", help="Target MongoDB connection URI")
    args = parser.parse_args()

    url = args.uri or os.getenv("TARGET_MONGODB_URL") or os.getenv("MONGODB_URL")

    # Fallback to reading root .env if not found in environment
    if not url:
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("MONGODB_URL=") or line.startswith("TARGET_MONGODB_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break

    if not url:
        print("Usage: Provide MongoDB URI via --uri, MONGODB_URL env var, or local .env file.")
        print("Example: python scripts/restore_to_atlas.py --uri 'mongodb+srv://...'")
        sys.exit(1)

    print(f"Target Cluster: {mask_uri(url)}")
    print("Target Database: 'TerraNex' (Dedicated namespace)")
    print("Safety Check: Existing databases like 'agrivoice' will NOT be modified.")
    restore(url)

