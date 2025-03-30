#!/usr/bin/env python
"""
MongoDB Duplicate Cleanup Utility for Podcast Maker

This script identifies and removes duplicate entries in the MongoDB database
based on content matching. It keeps the newest record in each duplicate set.
"""

import os
import json
import sys
import hashlib
from datetime import datetime
from pymongo import MongoClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='[%(asctime)s] [%(levelname)s] %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')
logger = logging.getLogger(__name__)

def connect_to_mongodb():
    """Connect to the MongoDB database"""
    try:
        mongo_client = MongoClient("mongodb://admin:password@localhost:27017/")
        db = mongo_client["podcast_maker_db"]
        podcast_collection = db["podcasts"]
        logger.info("Connected to MongoDB successfully")
        return mongo_client, db, podcast_collection
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")
        return None, None, None

def generate_content_hash(record):
    """Generate a hash from the content of a record"""
    original_text = record.get('original_text', '')
    translated_text = record.get('translated_text', '')
    content = f"{original_text}|{translated_text or ''}"
    return hashlib.md5(content.encode('utf-8')).hexdigest()

def add_missing_hashes(collection):
    """Add content_hash field to any records missing it"""
    try:
        records = list(collection.find({'content_hash': {'$exists': False}}))
        if not records:
            logger.info("No records missing content_hash field")
            return 0
            
        logger.info(f"Adding content_hash to {len(records)} records")
        for record in records:
            content_hash = generate_content_hash(record)
            collection.update_one(
                {'_id': record['_id']},
                {'$set': {'content_hash': content_hash}}
            )
        
        logger.info(f"Added content_hash to {len(records)} records")
        return len(records)
    except Exception as e:
        logger.error(f"Error adding content hashes: {str(e)}")
        return 0

def find_duplicates(collection):
    """Find duplicate records by content hash"""
    try:
        # Find duplicates by original text (more reliable than hash for near-duplicates)
        pipeline = [
            {"$group": {
                "_id": "$original_text",
                "count": {"$sum": 1},
                "records": {"$push": {
                    "id": "$_id",
                    "chunk_id": "$chunk_id",
                    "created_at": "$created_at",
                    "has_audio": {"$cond": [{"$ifNull": ["$audio_data", False]}, True, False]},
                    "is_standalone": {"$ifNull": ["$is_standalone_translation", False]}
                }}
            }},
            {"$match": {"count": {"$gt": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        duplicate_groups = list(collection.aggregate(pipeline))
        
        if not duplicate_groups:
            # If no duplicates found by exact text match, try content hash
            pipeline_hash = [
                {"$group": {
                    "_id": "$content_hash",
                    "count": {"$sum": 1},
                    "records": {"$push": {
                        "id": "$_id",
                        "chunk_id": "$chunk_id",
                        "created_at": "$created_at",
                        "has_audio": {"$cond": [{"$ifNull": ["$audio_data", False]}, True, False]},
                        "is_standalone": {"$ifNull": ["$is_standalone_translation", False]}
                    }}
                }},
                {"$match": {"count": {"$gt": 1}}},
                {"$sort": {"count": -1}}
            ]
            
            duplicate_groups = list(collection.aggregate(pipeline_hash))
            
            if not duplicate_groups:
                logger.info("No duplicate groups found")
                return []
                
        logger.info(f"Found {len(duplicate_groups)} groups of duplicates")
        
        return duplicate_groups
    except Exception as e:
        logger.error(f"Error finding duplicates: {str(e)}")
        return []

def remove_duplicates(collection, duplicate_groups, dry_run=False):
    """Remove duplicate records, keeping the newest in each group"""
    if not duplicate_groups:
        return 0
        
    removed_count = 0
    
    for group in duplicate_groups:
        hash_value = group['_id']
        records = group['records']
        count = group['count']
        
        logger.info(f"Processing duplicate group with hash/text '{hash_value[:30]}...': {count} records")
        
        # Sort records - prioritize ones with audio if possible, then by creation date (newest first)
        # Handle records that might not have created_at or other fields
        records_with_dates = []
        for record in records:
            record_id = record['id']
            # Get the full record
            full_record = collection.find_one({'_id': record_id})
            
            # Determine if this is a record with audio data
            has_audio = 'audio_data' in full_record
            is_standalone = full_record.get('is_standalone_translation', False)
            created_at = full_record.get('created_at', datetime.min)
            
            # Calculate a score - prioritize records with audio, then by date
            score = (2 if has_audio else 0) + (0 if is_standalone else 1)
            records_with_dates.append((record, created_at, score))
            
        # Sort by score (descending) and then by date (newest first)
        sorted_records = sorted(records_with_dates, key=lambda x: (x[2], x[1]), reverse=True)
        
        # Keep the highest scored record, delete the rest
        if sorted_records:
            keep_record = sorted_records[0][0]
            logger.info(f"Keeping record with ID: {keep_record['id']} (highest score)")
            
            for record, _, score in sorted_records[1:]:
                # Only delete records with lower scores
                logger.info(f"{'Would remove' if dry_run else 'Removing'} duplicate record with ID: {record['id']}")
                if not dry_run:
                    collection.delete_one({'_id': record['id']})
                    removed_count += 1
    
    logger.info(f"{'Would have removed' if dry_run else 'Removed'} {removed_count} duplicate records")
    return removed_count

def analyze_database(collection):
    """Analyze the database for statistics"""
    total_records = collection.count_documents({})
    english_only = collection.count_documents({'is_chinese': False})
    chinese = collection.count_documents({'is_chinese': True})
    standalone_translations = collection.count_documents({'is_standalone_translation': True})
    
    # Count by voice
    voice_stats = {}
    voices = collection.distinct('voice')
    for voice in voices:
        if voice:
            count = collection.count_documents({'voice': voice})
            voice_stats[voice] = count
    
    # Count by tone
    tone_stats = {}
    tones = collection.distinct('tone')
    for tone in tones:
        if tone:
            count = collection.count_documents({'tone': tone})
            tone_stats[tone] = count
    
    # Print statistics
    logger.info("======= DATABASE STATISTICS =======")
    logger.info(f"Total records: {total_records}")
    logger.info(f"English only: {english_only}")
    logger.info(f"Chinese translations: {chinese}")
    logger.info(f"Standalone translations: {standalone_translations}")
    logger.info(f"Voice distribution: {voice_stats}")
    logger.info(f"Tone distribution: {tone_stats}")
    logger.info("=================================")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Clean up duplicates in the podcast database')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--analyze', action='store_true', help='Analyze the database without making changes')
    args = parser.parse_args()
    
    # Connect to MongoDB
    client, db, collection = connect_to_mongodb()
    if collection is None:
        sys.exit(1)
    
    if args.analyze:
        analyze_database(collection)
        sys.exit(0)
    
    # Add content_hash to records missing it
    add_missing_hashes(collection)
    
    # Find and remove duplicates
    duplicate_groups = find_duplicates(collection)
    if duplicate_groups:
        remove_duplicates(collection, duplicate_groups, dry_run=args.dry_run)
    
    # Final analysis
    analyze_database(collection)
    
    logger.info("Cleanup complete")

if __name__ == "__main__":
    main() 