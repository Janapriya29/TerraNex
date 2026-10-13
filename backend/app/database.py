import os
import re

# =====================================
# MOCK COLLECTION FOR OFFLINE / TEST
# =====================================

class MockCollection:
    def __init__(self, name):
        self.name = name
        self.store = []

    def _matches(self, doc, filter_dict):
        if not filter_dict:
            return True
        for k, v in filter_dict.items():
            if k == "_id":
                if str(doc.get("_id")) != str(v):
                    return False
            elif k == "email":
                doc_email = str(doc.get("email", "")).strip().lower()
                if isinstance(v, dict) and "$regex" in v:
                    pattern = v["$regex"]
                    flags = re.IGNORECASE if "i" in v.get("$options", "") else 0
                    if not re.search(pattern, doc_email, flags):
                        return False
                else:
                    if doc_email != str(v).strip().lower():
                        return False
            elif isinstance(v, dict) and "$regex" in v:
                doc_val = str(doc.get(k, ""))
                pattern = v["$regex"]
                flags = re.IGNORECASE if "i" in v.get("$options", "") else 0
                if not re.search(pattern, doc_val, flags):
                    return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def find_one(self, filter=None, *args, **kwargs):
        if filter is None or len(filter) == 0:
            return self.store[0] if self.store else None
        for doc in self.store:
            if self._matches(doc, filter):
                return doc
        return None

    def insert_one(self, doc, *args, **kwargs):
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id

        import uuid
        doc_id = doc.get("_id") or uuid.uuid4().hex[:24]
        doc_copy = dict(doc)
        doc_copy["_id"] = doc_id
        self.store.append(doc_copy)
        return InsertResult(doc_id)

    def find(self, filter=None, *args, **kwargs):
        class MockCursor:
            def __init__(self, docs):
                self.docs = list(docs)

            def sort(self, key, direction=1):
                reverse = direction == -1
                try:
                    self.docs.sort(key=lambda d: d.get(key, 0), reverse=reverse)
                except Exception:
                    pass
                return self

            def __iter__(self):
                return iter(self.docs)

            def __len__(self):
                return len(self.docs)

            def __getitem__(self, idx):
                return self.docs[idx]

        if filter:
            matched = [d for d in self.store if self._matches(d, filter)]
            return MockCursor(matched)
        return MockCursor(self.store)


# =====================================
# MONGODB CONNECTION
# =====================================

try:
    from pymongo import MongoClient
    HAS_PYMONGO = True
except ImportError:
    HAS_PYMONGO = False
    MongoClient = None

MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb://localhost:27017"
)

client = None
is_connected = False

if HAS_PYMONGO:
    try:
        timeout_ms = int(os.getenv("MONGODB_TIMEOUT_MS", "10000"))
        client = MongoClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=timeout_ms
        )
        client.admin.command("ping")
        db = client["TerraNex"]
        users_collection = db["users"]
        disease_history_collection = db["disease_history"]
        crop_history_collection = db["crop_history"]
        is_connected = True
        print("MongoDB connected successfully!")
    except Exception as e:
        print("MongoDB connection failed, falling back to offline collections:", e)
        is_connected = False

if not is_connected:
    print("Warning: pymongo is not installed or MongoDB is unavailable. Using offline mock collections.")
    client = None
    db = {
        "users": MockCollection("users"),
        "disease_history": MockCollection("disease_history"),
        "crop_history": MockCollection("crop_history")
    }
    users_collection = db["users"]
    disease_history_collection = db["disease_history"]
    crop_history_collection = db["crop_history"]