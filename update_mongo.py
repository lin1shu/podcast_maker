from pymongo import MongoClient; client = MongoClient("mongodb://admin:password@localhost:27017/"); db = client["podcast_maker_db"]; coll = db["podcasts"]; res = coll.update_one({}, {"$set": {"source_url": "https://example.com/test_update"}}); print(f"Updated {res.modified_count} document(s)")
