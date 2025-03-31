from flask import Blueprint, request, jsonify, session, current_app
import logging
import json
import uuid
from datetime import datetime
from app.services.audio_processor import AudioProcessor
from app.services.database import save_podcast

# Get logger
logger = logging.getLogger(__name__)

# Create API blueprint
api_bp = Blueprint('api', __name__)

@api_bp.route('/process_chunk', methods=['POST'])
def process_chunk():
    """
    Universal endpoint to process a single chunk of text
    This handles both initial setup and processing of each chunk
    """
    try:
        # Log request details
        logger.info("==================== /process_chunk REQUEST RECEIVED ====================")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content-Type: {request.headers.get('Content-Type')}")
        
        # Parse request parameters
        if request.is_json:
            data = request.get_json()
            text = data.get('text', '')
            voice = data.get('voice', 'nova')
            tone = data.get('tone', 'neutral')
            is_chinese = data.get('is_chinese', False)
            source_url = data.get('source_url', '')
            title = data.get('title', 'Untitled Podcast')
        else:
            text = request.form.get('text', '')
            voice = request.form.get('voice', 'nova')
            tone = request.form.get('tone', 'neutral')
            is_chinese = request.form.get('is_chinese', 'false').lower() == 'true'
            source_url = request.form.get('source_url', '')
            title = request.form.get('title', 'Untitled Podcast')
        
        # Input validation
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Validate voice
        if voice not in current_app.config['AVAILABLE_VOICES']:
            voice = 'nova'  # Default to 'nova' if invalid
        
        # Validate tone
        if tone not in current_app.config['AVAILABLE_TONES']:
            tone = 'neutral'  # Default to 'neutral' if invalid
            
        # Make session permanent
        session.permanent = True
        
        # Get session data or initialize new
        if 'podcast_data' not in session:
            session['podcast_data'] = {
                'id': str(uuid.uuid4()),
                'title': title,
                'voice': voice,
                'tone': tone,
                'is_chinese': is_chinese,
                'source_url': source_url,
                'chunks': [],
                'created_at': datetime.now().isoformat()
            }
        
        # Process the chunk
        processor = AudioProcessor(
            current_app.config['OPENAI_API_KEY'],
            current_app.config['TONE_INSTRUCTIONS']
        )
        
        # Generate audio for the chunk
        result = processor.generate_audio(text, voice, tone, is_chinese)
        
        if not result['success']:
            return jsonify({"error": result['error']}), 500
        
        # Create chunk data
        chunk_id = str(uuid.uuid4())
        chunk_data = {
            'chunk_id': chunk_id,
            'text': text,
            'filename': result['filename'],
            'processed': True
        }
        
        # Add chunk to session data
        session['podcast_data']['chunks'].append(chunk_data)
        session.modified = True
        
        # Save to database if this is the first chunk
        if len(session['podcast_data']['chunks']) == 1:
            podcast_data = session['podcast_data'].copy()
            podcast_data['created_at'] = datetime.now()
            save_podcast(podcast_data)
        
        # Return success response
        return jsonify({
            "success": True,
            "chunk_id": chunk_id,
            "audio_url": f"/audio/{result['filename']}",
            "text": text,
            "total_chunks": len(session['podcast_data']['chunks'])
        })
        
    except Exception as e:
        logger.error(f"Error processing chunk: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/chunk_text_only', methods=['POST'])
def chunk_text_only():
    """
    Endpoint to chunk text without generating audio
    """
    try:
        # Parse request parameters
        if request.is_json:
            data = request.get_json()
            text = data.get('text', '')
            max_tokens = data.get('max_tokens', current_app.config['MAX_TOKEN_LENGTH'])
        else:
            text = request.form.get('text', '')
            max_tokens_str = request.form.get('max_tokens', str(current_app.config['MAX_TOKEN_LENGTH']))
            max_tokens = int(max_tokens_str) if max_tokens_str.isdigit() else current_app.config['MAX_TOKEN_LENGTH']
        
        # Input validation
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Initialize audio processor
        processor = AudioProcessor(
            current_app.config['OPENAI_API_KEY'],
            current_app.config['TONE_INSTRUCTIONS']
        )
        
        # Chunk the text
        chunks = processor.chunk_text(text, max_tokens)
        
        # Store chunks in session
        session['text_chunks'] = chunks
        session['current_chunk_index'] = 0
        session.modified = True
        
        # Return success response
        return jsonify({
            "success": True,
            "num_chunks": len(chunks),
            "chunks": chunks
        })
        
    except Exception as e:
        logger.error(f"Error chunking text: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/get_next_text_chunk', methods=['POST'])
def get_next_text_chunk():
    """
    Get the next text chunk from session storage
    """
    try:
        # Check if chunks exist in session
        if 'text_chunks' not in session or 'current_chunk_index' not in session:
            return jsonify({
                "success": False,
                "error": "No text chunks available. Please chunk text first."
            }), 400
        
        chunks = session['text_chunks']
        current_index = session['current_chunk_index']
        
        # Check if we've reached the end
        if current_index >= len(chunks):
            return jsonify({
                "success": True,
                "is_last": True,
                "message": "All chunks have been processed."
            })
        
        # Get the current chunk
        current_chunk = chunks[current_index]
        
        # Increment the index for next time
        session['current_chunk_index'] = current_index + 1
        session.modified = True
        
        # Return the chunk
        return jsonify({
            "success": True,
            "chunk": current_chunk,
            "current_index": current_index,
            "total_chunks": len(chunks),
            "is_last": current_index == len(chunks) - 1
        })
        
    except Exception as e:
        logger.error(f"Error getting next text chunk: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/get_all_processed_chunks', methods=['GET'])
def get_all_processed_chunks():
    """
    Get all processed chunks from the current session
    """
    try:
        if 'podcast_data' not in session or 'chunks' not in session['podcast_data']:
            return jsonify({"chunks": [], "total": 0})
        
        chunks = session['podcast_data']['chunks']
        return jsonify({
            "chunks": chunks,
            "total": len(chunks)
        })
        
    except Exception as e:
        logger.error(f"Error retrieving processed chunks: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/translate_text', methods=['POST'])
def translate_text():
    """
    Endpoint to translate text using OpenAI API
    """
    try:
        # Parse request parameters
        if request.is_json:
            data = request.get_json()
            text = data.get('text', '')
            target_language = data.get('target_language', 'Chinese')
        else:
            text = request.form.get('text', '')
            target_language = request.form.get('target_language', 'Chinese')
        
        # Input validation
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Create OpenAI client
        from openai import OpenAI
        client = OpenAI(api_key=current_app.config['OPENAI_API_KEY'])
        
        # Translate text
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a translator. Translate the following text to {target_language}. Preserve the meaning, tone, and style of the original text."},
                {"role": "user", "content": text}
            ]
        )
        
        translated_text = response.choices[0].message.content
        
        # Return success response
        return jsonify({
            "success": True,
            "original_text": text,
            "translated_text": translated_text,
            "target_language": target_language
        })
        
    except Exception as e:
        logger.error(f"Error translating text: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/test_connection', methods=['GET', 'OPTIONS'])
def test_connection():
    """
    Simple endpoint to test API connectivity
    """
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    return jsonify({
        "status": "success",
        "message": "Connection successful",
        "timestamp": datetime.now().isoformat()
    })

def _build_cors_preflight_response():
    """Build CORS preflight response"""
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response 