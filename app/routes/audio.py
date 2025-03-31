from flask import Blueprint, send_file, send_from_directory, abort, jsonify, current_app
import os
import logging
from app.services.database import get_podcast_by_chunk_id, get_podcast_collection
from bson.binary import Binary

# Get logger
logger = logging.getLogger(__name__)

# Create audio blueprint
audio_bp = Blueprint('audio', __name__)

@audio_bp.route('/<filename>')
def serve_audio(filename):
    """Serve audio file"""
    try:
        # Get the absolute path to the audio directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        audio_dir = os.path.join(base_dir, 'audio')
        static_audio_dir = os.path.join(base_dir, 'static', 'audio')
        
        # Check if file exists in the audio directory
        audio_path = os.path.join(audio_dir, filename)
        logger.info(f"Checking for audio file at: {audio_path}")
        if os.path.exists(audio_path):
            logger.info(f"Serving audio file from audio directory: {audio_path}")
            return send_file(audio_path, mimetype='audio/mpeg')
        
        # If not found in audio directory, check in static upload folder
        static_path = os.path.join(static_audio_dir, filename)
        logger.info(f"Checking for audio file at: {static_path}")
        if os.path.exists(static_path):
            logger.info(f"Serving audio file from static directory: {static_path}")
            return send_file(static_path, mimetype='audio/mpeg')
            
        logger.error(f"Audio file not found: {filename}")
        return jsonify({"error": "Audio file not found"}), 404
    except Exception as e:
        logger.error(f"Error serving audio file {filename}: {str(e)}")
        abort(404)

@audio_bp.route('/get_podcast_audio/<chunk_id>', methods=['GET'])
def get_podcast_audio(chunk_id):
    """Get podcast audio by chunk ID"""
    try:
        logger.info(f"get_podcast_audio called with chunk_id: {chunk_id}")
        
        # Get the absolute path to the audio directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        audio_dir = os.path.join(base_dir, 'audio')
        logger.info(f"Base directory: {base_dir}")
        logger.info(f"Audio directory: {audio_dir}")
        
        # First, check if there's an audio file directly matching the chunk_id pattern
        audio_patterns = [
            f"chunk_{chunk_id}.mp3",  # Most common pattern for the app
            f"{chunk_id}.mp3",
            f"translation_{chunk_id}.mp3"
        ]
        
        # Check each pattern
        for pattern in audio_patterns:
            full_path = os.path.join(audio_dir, pattern)
            logger.info(f"Checking path: {full_path}")
            if os.path.exists(full_path):
                logger.info(f"Found direct audio file match: {full_path}")
                return send_file(full_path, mimetype='audio/mpeg')
        
        # List all audio files for debugging
        try:
            audio_files = os.listdir(audio_dir)
            mp3_files = [f for f in audio_files if f.endswith('.mp3')]
            logger.info(f"Available MP3 files in audio directory: {mp3_files}")
            
            # Search for partial matches in filenames
            partial_matches = [f for f in mp3_files if chunk_id in f]
            if partial_matches:
                logger.info(f"Found partial matches for chunk_id {chunk_id}: {partial_matches}")
                # Use the first match
                audio_path = os.path.join(audio_dir, partial_matches[0])
                if os.path.exists(audio_path):
                    logger.info(f"Using partial match: {audio_path}")
                    return send_file(audio_path, mimetype='audio/mpeg')
                else:
                    logger.warning(f"Partial match path doesn't exist: {audio_path}")
        except Exception as e:
            logger.error(f"Error listing audio directory: {str(e)}")
        
        # No matches found anywhere
        logger.error(f"No audio file found for chunk_id: {chunk_id}")
        return jsonify({"error": "Audio file not found"}), 404
            
    except Exception as e:
        logger.error(f"Error retrieving podcast audio for chunk {chunk_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@audio_bp.route('/download/<filename>')
def download_file(filename):
    """Download audio file"""
    try:
        return send_from_directory('audio', filename, as_attachment=True)
    except Exception as e:
        logger.error(f"Error downloading file {filename}: {str(e)}")
        abort(404) 