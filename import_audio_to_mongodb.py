import os
import json
import re
import time
from datetime import datetime
from pymongo import MongoClient
from bson.binary import Binary
import logging
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='[%(asctime)s] [%(levelname)s] %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')
logger = logging.getLogger(__name__)

# MongoDB connection
try:
    mongo_client = MongoClient("mongodb://admin:password@localhost:27017/")
    db = mongo_client["podcast_maker_db"]
    podcast_collection = db["podcasts"]
    logger.info("Connected to MongoDB successfully")
except Exception as e:
    logger.error(f"Error connecting to MongoDB: {str(e)}")
    exit(1)

def generate_content_hash(text, translated_text=None):
    """Generate a hash of content to identify duplicates"""
    content = f"{text}|{translated_text or ''}"
    return hashlib.md5(content.encode('utf-8')).hexdigest()

def import_audio_files():
    """Import all audio files and their corresponding JSON data into MongoDB"""
    
    # Audio directory
    audio_dir = 'audio'
    
    # Get all files in the audio directory
    files = os.listdir(audio_dir)
    
    # Find all mp3 files
    mp3_files = [f for f in files if f.endswith('.mp3')]
    logger.info(f"Found {len(mp3_files)} MP3 files to import")
    
    imported_count = 0
    skipped_count = 0
    error_count = 0
    
    # Keep track of content hashes to prevent duplicates within this import session
    imported_hashes = set()
    
    for mp3_file in mp3_files:
        try:
            # Extract the UUID from the filename
            match = re.match(r'chunk_([0-9a-f-]+)\.mp3', mp3_file)
            if not match:
                logger.warning(f"Could not extract UUID from filename: {mp3_file}, skipping")
                skipped_count += 1
                continue
            
            chunk_id = match.group(1)
            
            # Check if a document with this chunk_id already exists
            existing_doc = podcast_collection.find_one({'chunk_id': chunk_id})
            if existing_doc:
                logger.info(f"Document with chunk_id {chunk_id} already exists, skipping")
                skipped_count += 1
                continue
                
            # Get the corresponding JSON file
            json_file = f"chunk_{chunk_id}.json"
            json_path = os.path.join(audio_dir, json_file)
            
            if not os.path.exists(json_path):
                logger.warning(f"JSON file not found for {mp3_file}, skipping")
                skipped_count += 1
                continue
            
            # Read the JSON data
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            original_text = json_data.get('original_text', '')
            translated_text = json_data.get('translated_text', None)
            
            # Generate content hash to detect duplicate content
            content_hash = generate_content_hash(original_text, translated_text)
            
            # Check if we've already imported this content in this session
            if content_hash in imported_hashes:
                logger.info(f"Content already imported in this session (hash: {content_hash}), skipping {mp3_file}")
                skipped_count += 1
                continue
                
            # Check if similar content already exists in the database
            existing_by_content = podcast_collection.find_one({
                'original_text': original_text,
                'translated_text': translated_text
            })
            
            if existing_by_content:
                logger.info(f"Similar content already exists in database, skipping {mp3_file}")
                skipped_count += 1
                continue
            
            # Read the MP3 file
            mp3_path = os.path.join(audio_dir, mp3_file)
            with open(mp3_path, 'rb') as f:
                audio_binary = Binary(f.read())
            
            # Get file metadata for creation time
            file_ctime = os.path.getctime(mp3_path)
            
            # Create document for MongoDB
            mongo_document = {
                'chunk_id': chunk_id,
                'original_text': original_text,
                'translated_text': translated_text,
                'is_chinese': translated_text is not None,
                'voice': 'nova',  # Default, as we don't have this in the JSON
                'tone': 'friendly',  # Default, as we don't have this in the JSON
                'audio_data': audio_binary,
                'created_at': datetime.fromtimestamp(file_ctime),
                'imported_at': datetime.now(),
                'content_hash': content_hash  # Store the hash for future duplicate detection
            }
            
            # Insert into MongoDB
            result = podcast_collection.insert_one(mongo_document)
            logger.info(f"Imported {mp3_file} with ID: {result.inserted_id}")
            imported_count += 1
            
            # Add hash to our set to prevent duplicates within this import session
            imported_hashes.add(content_hash)
            
            # Sleep briefly to avoid overloading the system
            time.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error importing {mp3_file}: {str(e)}")
            error_count += 1
    
    logger.info(f"Import complete: {imported_count} files imported, {skipped_count} skipped, {error_count} errors")
    return imported_count, skipped_count, error_count

def remove_duplicates():
    """Find and remove duplicate entries in the database"""
    try:
        # Get all documents except audio data
        records = list(podcast_collection.find({}, {'audio_data': 0}))
        
        if not records:
            logger.info("No records found in database")
            return 0
            
        logger.info(f"Checking {len(records)} records for duplicates")
        
        # Group records by content
        content_groups = {}
        for record in records:
            original_text = record.get('original_text', '')
            translated_text = record.get('translated_text', None)
            
            content_key = f"{original_text}|{translated_text or ''}"
            
            if content_key not in content_groups:
                content_groups[content_key] = []
                
            content_groups[content_key].append(record)
        
        # Find groups with more than one record (duplicates)
        duplicates_count = 0
        for content_key, group in content_groups.items():
            if len(group) > 1:
                # Sort by creation date to keep the newest one
                sorted_group = sorted(group, key=lambda x: x.get('created_at', datetime.min), reverse=True)
                
                # Keep the newest one, delete the rest
                for record in sorted_group[1:]:
                    logger.info(f"Removing duplicate record with ID: {record['_id']}")
                    podcast_collection.delete_one({'_id': record['_id']})
                    duplicates_count += 1
        
        logger.info(f"Removed {duplicates_count} duplicate records")
        return duplicates_count
        
    except Exception as e:
        logger.error(f"Error removing duplicates: {str(e)}")
        return 0

if __name__ == "__main__":
    logger.info("Starting audio import to MongoDB")
    
    # First, remove any existing duplicates
    removed = remove_duplicates()
    if removed:
        logger.info(f"Cleaned up {removed} duplicate records before importing")
    
    # Now import new files
    imported, skipped, errors = import_audio_files()
    logger.info(f"Import summary: {imported} imported, {skipped} skipped, {errors} errors")
    
    # Final check for duplicates after import
    removed = remove_duplicates()
    if removed:
        logger.info(f"Cleaned up {removed} duplicate records after importing") 