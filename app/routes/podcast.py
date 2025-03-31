from flask import Blueprint, request, jsonify, session, current_app, render_template
from app.services.database import get_all_podcasts, get_podcast
import logging
import json
import os
from datetime import datetime
from bson.objectid import ObjectId

# Get logger
logger = logging.getLogger(__name__)

# Create podcast blueprint
podcast_bp = Blueprint('podcast', __name__)

def check_audio_exists(chunk_id=None, translation_id=None):
    """Check if audio file exists for the given IDs"""
    # Get a list of all mp3 files in the audio directory
    audio_files = os.listdir('audio')
    mp3_files = [f for f in audio_files if f.endswith('.mp3')]
    
    if chunk_id:
        # First check for exact pattern matches
        chunk_patterns = [f"chunk_{chunk_id}.mp3", f"{chunk_id}.mp3"]
        for pattern in chunk_patterns:
            if pattern in mp3_files:
                logger.info(f"Found exact audio file match: {pattern}")
                return True
        
        # Then check for any file containing the chunk_id
        for file in mp3_files:
            if chunk_id in file:
                logger.info(f"Found audio file containing chunk_id: {file}")
                return True
    
    if translation_id:
        # First check for exact pattern matches
        translation_patterns = [f"{translation_id}.mp3", f"translation_{translation_id}.mp3"]
        for pattern in translation_patterns:
            if pattern in mp3_files:
                logger.info(f"Found exact audio file match: {pattern}")
                return True
                
        # Then check for any file containing the translation_id
        for file in mp3_files:
            if translation_id in file:
                logger.info(f"Found audio file containing translation_id: {file}")
                return True
    
    # No matching files found
    return False

@podcast_bp.route('/list', methods=['GET'])
def podcast_list():
    """List all podcasts"""
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Get podcasts from database with pagination
        skip = (page - 1) * per_page
        podcasts = get_all_podcasts(limit=per_page, skip=skip)
        
        # Get total count
        total_records = len(get_all_podcasts(limit=1000))  # Limited to 1000 to prevent performance issues
        total_pages = (total_records + per_page - 1) // per_page  # Ceiling division
        
        # Format records for template
        records = []
        for podcast in podcasts:
            # Log the raw document keys for debugging
            logger.info(f"Raw document keys: {list(podcast.keys())}")
            
            # Handle mongodb ObjectId for serialization
            if '_id' in podcast:
                podcast['_id'] = str(podcast['_id'])
            
            # Format datetime objects
            if 'created_at' in podcast and isinstance(podcast['created_at'], datetime):
                podcast['created_at'] = podcast['created_at'].isoformat()
            
            # Initialize variables for record data
            chunk_id = None
            translation_id = None
            original_text = ""
            translated_text = ""
            
            # The actual document structure based on logs
            if 'chunk_id' in podcast:
                # This is the structure we're seeing in the database
                chunk_id = podcast.get('chunk_id')
                original_text = podcast.get('original_text', '')
                translated_text = podcast.get('translated_text', '')
                logger.info(f"Found document with direct chunk_id: {chunk_id}")
                
                # Verify if audio file actually exists for this chunk_id
                if chunk_id and not check_audio_exists(chunk_id=chunk_id):
                    logger.info(f"No audio file found for chunk_id: {chunk_id}")
                    chunk_id = None  # Set to None if no audio file exists
            
            # Handle the old structure with nested chunks (just in case)
            elif 'chunks' in podcast and len(podcast['chunks']) > 0:
                chunk = podcast['chunks'][0]
                chunk_id = chunk.get('chunk_id')
                original_text = chunk.get('text', '')
                logger.info(f"Found document with nested chunk_id: {chunk_id}")
                
                # Verify if audio file actually exists for this chunk_id
                if chunk_id and not check_audio_exists(chunk_id=chunk_id):
                    logger.info(f"No audio file found for chunk_id: {chunk_id}")
                    chunk_id = None  # Set to None if no audio file exists
            
            # Handle translation_id for completeness (if we ever have it)
            elif 'translation_id' in podcast:
                translation_id = podcast.get('translation_id')
                original_text = podcast.get('original_text', '')
                translated_text = podcast.get('translated_text', '')
                logger.info(f"Found document with translation_id: {translation_id}")
                
                # Verify if audio file actually exists for this translation_id
                if translation_id and not check_audio_exists(translation_id=translation_id):
                    logger.info(f"No audio file found for translation_id: {translation_id}")
                    translation_id = None  # Set to None if no audio file exists
            
            # Create record in the format expected by the template
            record = {
                'chunk_id': chunk_id,
                'translation_id': translation_id,
                'original_text': original_text,
                'translated_text': translated_text,
                'source_url': podcast.get('source_url', ''),
                'created_at': podcast.get('created_at', '')
            }
            records.append(record)
            
            # Log the record for debugging
            logger.info(f"Record: chunk_id={record['chunk_id']}, translation_id={record['translation_id']}")
        
        logger.info(f"Total records processed: {len(records)}")
        
        return render_template('podcast_list.html', 
                              records=records, 
                              page=page,
                              per_page=per_page,
                              total_records=total_records,
                              total_pages=total_pages)
    except Exception as e:
        logger.error(f"Error retrieving podcast list: {str(e)}")
        return render_template('podcast_list.html', 
                              records=[], 
                              page=1,
                              per_page=10,
                              total_records=0,
                              total_pages=0,
                              error=str(e))

@podcast_bp.route('/get_history', methods=['GET'])
def get_podcast_history():
    """Get podcast history as JSON"""
    try:
        # Get podcasts from database
        podcasts = get_all_podcasts(limit=50)
        
        # Convert datetime objects to strings for JSON serialization
        for podcast in podcasts:
            if 'created_at' in podcast and isinstance(podcast['created_at'], datetime):
                podcast['created_at'] = podcast['created_at'].isoformat()
            
            # Convert MongoDB ObjectId to string
            if '_id' in podcast:
                podcast['_id'] = str(podcast['_id'])
        
        return jsonify({"podcasts": podcasts})
    except Exception as e:
        logger.error(f"Error retrieving podcast history: {str(e)}")
        return jsonify({"error": str(e)}), 500 