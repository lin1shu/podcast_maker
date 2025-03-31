from pymongo import MongoClient
import sys

try:
    # Connect to MongoDB
    mongo_uri = "mongodb://admin:password@localhost:27017/"
    client = MongoClient(mongo_uri)
    db = client["podcast_maker_db"]
    podcast_collection = db["podcasts"]
    
    # Count documents
    count = podcast_collection.count_documents({})
    print(f"Number of podcast records: {count}")
    
    # Print first few documents if any
    if count > 0:
        print("\nFirst 3 podcast records:")
        for doc in podcast_collection.find().limit(3):
            print(f"ID: {doc.get('_id')}")
            print(f"Title: {doc.get('title', 'No title')}")
            print(f"Created: {doc.get('created_at')}")
            print(f"Chunks: {len(doc.get('chunks', []))}")
            print("-" * 40)
    
except Exception as e:
    print(f"Error: {str(e)}")
    sys.exit(1) 