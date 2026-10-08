"""
FreshSight — Database
====================
Synchronous PyMongo connection.  Provides ``get_db()`` for obtaining the
database handle and ``seed_default_items()`` for first-run population.
"""

from pymongo import MongoClient
from pymongo.database import Database
from config import MONGO_URI, DB_NAME, DEFAULT_ITEMS

# ── Module-level singleton ────────────────────────────────────────────────────
_client: MongoClient | None = None
_db: Database | None = None


def get_db() -> Database:
    """Return the MongoDB database handle, creating the client on first call."""
    global _client, _db
    if _db is None:
        _client = MongoClient(MONGO_URI)
        _db = _client[DB_NAME]
        print(f"[FreshSight-DB] Connected to MongoDB → {DB_NAME}")
    return _db


def seed_default_items() -> None:
    """
    Populate or update the ``default_items`` collection to ensure initial targets exist.
    """
    db = get_db()

    seeded_count = 0
    for item_name, default_qty in DEFAULT_ITEMS.items():
        res = db.default_items.update_one(
            {"item_name": item_name},
            {
                "$set": {
                    "item_name": item_name,
                    "default_quantity": default_qty,
                },
                "$setOnInsert": {
                    "current_quantity": 0,
                    "status": "OUT_OF_STOCK"
                }
            },
            upsert=True
        )
        if res.upserted_id or res.modified_count:
            seeded_count += 1

    print(f"[FreshSight-DB] Checked/Seeded default items. Changes: {seeded_count}")
