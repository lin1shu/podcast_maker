from pymongo import MongoClient
import logging

# Initialize MongoDB client and collections
mongo_client = None
db = None
podcast_collection = None

logger = logging.getLogger(__name__)

def init_db(app):
    """Initialize database connection"""
    global mongo_client, db, podcast_collection
    
    try:
        # Build MongoDB connection string
        mongo_uri = f"mongodb://{app.config['MONGODB_USER']}:{app.config['MONGODB_PASSWORD']}@{app.config['MONGODB_HOST']}:{app.config['MONGODB_PORT']}/"
        
        # Connect to MongoDB
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client[app.config['MONGODB_DB']]
        podcast_collection = db["podcasts"]
        
        # Verify connection
        mongo_client.admin.command('ping')
        logger.info("Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")
        mongo_client = None
        db = None
        podcast_collection = None

def get_db():
    """Get database instance"""
    return db

def get_podcast_collection():
    """Get podcast collection instance"""
    return podcast_collection

def save_podcast(podcast_data):
    """Save podcast data to database"""
    if podcast_collection is not None:
        try:
            result = podcast_collection.insert_one(podcast_data)
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error saving podcast: {str(e)}")
    return None

def get_podcast(podcast_id):
    """Retrieve podcast by ID"""
    if podcast_collection is not None:
        try:
            return podcast_collection.find_one({"_id": podcast_id})
        except Exception as e:
            logger.error(f"Error retrieving podcast: {str(e)}")
    return None

def get_all_podcasts(limit=100, skip=0):
    """Get all podcasts with pagination"""
    if podcast_collection is not None:
        try:
            return list(podcast_collection.find().sort("created_at", -1).skip(skip).limit(limit))
        except Exception as e:
            logger.error(f"Error retrieving podcasts: {str(e)}")
    return []

def get_podcast_by_chunk_id(chunk_id):
    """Retrieve podcast by chunk ID"""
    if podcast_collection is not None:
        try:
            return podcast_collection.find_one({"chunks.chunk_id": chunk_id})
        except Exception as e:
            logger.error(f"Error retrieving podcast by chunk ID: {str(e)}")
    return None 