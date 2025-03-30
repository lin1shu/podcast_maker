import sys
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, Response, session
import os
import json
from datetime import datetime, timedelta
from openai import OpenAI
import io
import uuid
import tempfile
import re
import pydub
import tiktoken
import logging
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='[%(asctime)s] [%(levelname)s] %(message)s',
                   datefmt='%Y-%m-%d %H:%M:%S',
                   handlers=[
                       logging.StreamHandler(sys.stdout),
                       logging.FileHandler('app.log')
                   ])
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
# Use a fixed secret key for session management
app.secret_key = "podcast_maker_secret_key_fixed"
# Set session to be permanent and last for 1 hour
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
app.config['SESSION_TYPE'] = 'filesystem'

# Add CORS support
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Load configuration
def load_config():
    # First check if config.json exists
    if os.path.exists('config.json'):
        with open('config.json', 'r') as f:
            return json.load(f)
    # Fallback to environment variable
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        return {"api_key": api_key}
    return {}

config = load_config()
client = OpenAI(api_key=config.get("api_key"))

# Set the upload folder for storing MP3 files
UPLOAD_FOLDER = 'static/audio'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create an 'audio' directory if it doesn't exist
if not os.path.exists('audio'):
    os.makedirs('audio')

# List of available voices
AVAILABLE_VOICES = [
    "alloy", 
    "echo", 
    "fable", 
    "onyx", 
    "nova", 
    "shimmer"
]

# List of available tone options
AVAILABLE_TONES = [
    "neutral",
    "warm",
    "professional",
    "enthusiastic",
    "calm",
    "formal",
    "informal",
    "serious",
    "friendly"
]

# Tone instruction templates
TONE_INSTRUCTIONS = {
    "neutral": "Speak in a neutral, balanced tone, with moderate pacing and no particular emotion.",
    "warm": "Speak in a warm, friendly, and approachable manner, with a gentle pace and welcoming tone.",
    "professional": "Speak in a professional, clear, and authoritative manner with confident pacing.",
    "enthusiastic": "Speak with high energy, excitement, and enthusiasm, with dynamic pacing and expressive intonation.",
    "calm": "Speak in a calm, soothing, and relaxed manner, with slower pacing and gentle intonation.",
    "formal": "Speak in a formal, proper, and ceremonial manner, with measured pacing and dignified tone.",
    "informal": "Speak in a casual, relaxed, and conversational manner, with natural pacing and everyday language.",
    "serious": "Speak in a serious, thoughtful, and contemplative manner, with deliberate pacing and minimal emotion.",
    "friendly": "Speak in a friendly, personable, and engaging manner, with conversational pacing and a touch of warmth."
}

# Constants for chunking text
MAX_TOKEN_LENGTH = 2000  # Maximum tokens per chunk
SENTENCE_SPLIT_PATTERN = r'(?<=[.!?])\s+'  # Pattern to split text at sentence boundaries

def num_tokens_from_string(string, model="gpt-4o"):
    """Returns the number of tokens in a text string."""
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(string))

def chunk_text(text, max_tokens=MAX_TOKEN_LENGTH):
    """
    Split text into chunks not exceeding max_tokens,
    breaking at sentence boundaries when possible.
    Uses tiktoken to accurately count tokens.
    """
    total_tokens = num_tokens_from_string(text)
    print(f"Total tokens in input text: {total_tokens}")
    
    # If text is short enough, return it as is
    if total_tokens <= max_tokens:
        print(f"Text is short enough ({total_tokens} tokens), returning as single chunk")
        return [text]
    
    # Split text by sentences
    sentences = re.split(SENTENCE_SPLIT_PATTERN, text)
    print(f"Split into {len(sentences)} sentences")
    
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    for sentence in sentences:
        sentence_tokens = num_tokens_from_string(sentence)
        
        # If this single sentence exceeds the token limit, we need to split it further
        if sentence_tokens > max_tokens:
            # If we have content in the current chunk, add it first
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
                current_tokens = 0
            
            # Split the long sentence into smaller parts (by words)
            words = sentence.split(' ')
            sub_chunk = ""
            sub_tokens = 0
            
            for word in words:
                word_tokens = num_tokens_from_string(word + " ")
                if sub_tokens + word_tokens <= max_tokens:
                    sub_chunk += word + " "
                    sub_tokens += word_tokens
                else:
                    if sub_chunk:
                        chunks.append(sub_chunk.strip())
                    sub_chunk = word + " "
                    sub_tokens = word_tokens
            
            if sub_chunk:
                current_chunk = sub_chunk
                current_tokens = sub_tokens
        
        # If adding this sentence would exceed the limit, start a new chunk
        elif current_tokens + sentence_tokens > max_tokens:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence
            current_tokens = sentence_tokens
        else:
            # Add the sentence to the current chunk
            current_chunk += " " + sentence if current_chunk else sentence
            current_tokens += sentence_tokens
    
    # Add the last chunk if it's not empty
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    # Print token counts for each chunk
    for i, chunk in enumerate(chunks):
        chunk_tokens = num_tokens_from_string(chunk)
        print(f"Chunk {i+1}/{len(chunks)}: {chunk_tokens} tokens")
    
    return chunks

def merge_audio_files(audio_files):
    """Merge multiple audio files into a single MP3 file"""
    combined = pydub.AudioSegment.empty()
    for file_path in audio_files:
        audio = pydub.AudioSegment.from_mp3(file_path)
        combined += audio
    
    output_filename = f"{uuid.uuid4()}.mp3"
    output_path = os.path.join('audio', output_filename)
    combined.export(output_path, format="mp3")
    
    return output_filename

@app.route('/')
def index():
    # Clear any previous session data
    session.clear()
    return render_template('index.html', voices=AVAILABLE_VOICES, tones=AVAILABLE_TONES, api_key_set=bool(config.get("api_key")))

@app.route('/process_chunk', methods=['POST'])
def process_chunk():
    """
    Universal endpoint to process a single chunk of text
    This handles both initial setup and processing of each chunk
    """
    try:
        # Log the incoming request with more details
        logger.info("==================== /process_chunk REQUEST RECEIVED ====================")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content-Type: {request.headers.get('Content-Type')}")
        logger.info(f"User-Agent: {request.headers.get('User-Agent')}")
        logger.info(f"Origin: {request.headers.get('Origin')}")
        
        # Log complete request data
        if request.is_json:
            request_data = request.get_json()
            logger.info(f"JSON request data: {json.dumps(request_data, indent=2)}")
        else:
            logger.info(f"Form data: {request.form}")
            logger.info(f"Args: {request.args}")
        
        # Make session permanent
        session.permanent = True
        
        # Parse request parameters
        request_data = request.get_json() if request.is_json else {}
        
        # If it's the first chunk, we need to initialize the session
        if request_data.get('is_first_chunk', False):
            text = request_data.get('text', '')
            voice = request_data.get('voice', 'alloy')
            tone = request_data.get('tone', 'neutral')
            is_chinese = request_data.get('is_chinese', False)
            
            logger.info(f"Processing first chunk with voice={voice}, tone={tone}, chinese={is_chinese}")
            logger.debug(f"Text length: {len(text)} characters")
            
            # Chunk the text
            text_chunks = chunk_text(text)
            
            # Set up session
            session_id = str(uuid.uuid4())
            session['chunks'] = text_chunks
            session['voice'] = voice
            session['tone'] = tone
            session['current_chunk'] = 0
            session['total_chunks'] = len(text_chunks)
            session['session_id'] = session_id
            session['is_chinese'] = is_chinese
            session['processed_chunks'] = []
            
            logger.info(f"Created new session: {session_id} with {len(text_chunks)} chunks")
            
            # If there's only one chunk, process it immediately
            if len(text_chunks) == 1:
                logger.info("Processing single chunk immediately")
                chunk_info = process_single_chunk(text_chunks[0], voice, tone, is_chinese)
                return jsonify({
                    'is_chunked': False,
                    'total_chunks': 1,
                    'current_chunk': 1,
                    'chunk_info': chunk_info
                })
            
            # Otherwise, return info about chunking
            logger.info(f"Returning chunking info for {len(text_chunks)} chunks")
            return jsonify({
                'is_chunked': True,
                'total_chunks': len(text_chunks),
                'session_id': session_id
            })
        
        # If it's not the first chunk, process the next chunk
        else:
            logger.info("Processing subsequent chunk")
            
            # Get session data
            chunks = session.get('chunks', [])
            voice = session.get('voice')
            tone = session.get('tone')
            current_chunk_index = session.get('current_chunk', 0)
            total_chunks = session.get('total_chunks', 0)
            is_chinese = session.get('is_chinese', False)
            processed_chunks = session.get('processed_chunks', [])
            
            # Debug logging
            logger.info(f"Processing chunk {current_chunk_index+1}/{total_chunks}")
            logger.debug(f"Session data: voice={voice}, tone={tone}, is_chinese={is_chinese}")
            
            # Check if session data exists
            if not chunks or current_chunk_index >= total_chunks:
                logger.error("No more chunks to process or session expired")
                return jsonify({'error': 'No more chunks to process or session expired'})
            
            # Get the current chunk
            chunk = chunks[current_chunk_index]
            
            # Process the chunk
            chunk_info = process_single_chunk(chunk, voice, tone, is_chinese)
            
            # Add to processed chunks
            processed_chunks.append(chunk_info)
            session['processed_chunks'] = processed_chunks
            
            # Update current chunk index
            session['current_chunk'] = current_chunk_index + 1
            
            # Return chunk info
            logger.info(f"Completed chunk {current_chunk_index+1}/{total_chunks}")
            return jsonify({
                'current_chunk': current_chunk_index + 1,
                'total_chunks': total_chunks,
                'is_last_chunk': (current_chunk_index + 1 >= total_chunks),
                'chunk_info': chunk_info
            })
    
    except Exception as e:
        import traceback
        logger.error(f"Error in process_chunk: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f"Error: {str(e)}"})

def process_single_chunk(text, voice, tone, is_chinese):
    """Process a single chunk of text - translating if needed and converting to speech"""
    # Default values
    original_text = text
    translated_text = None
    
    logger.info(f"Processing single chunk: voice={voice}, tone={tone}, is_chinese={is_chinese}")
    logger.debug(f"Text length: {len(text)} characters")
    
    # If Chinese translation is requested
    if is_chinese:
        logger.info("Translating text to Chinese")
        # Translate text to Chinese
        translation_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a translator that translates text to Chinese. Provide only the translation without explanations."},
                {"role": "user", "content": f"Translate the following text to Simplified Chinese:\n\n{text}"}
            ],
            temperature=0.3
        )
        
        translated_text = translation_response.choices[0].message.content
        logger.info("Translation complete")
        logger.debug(f"Translated text length: {len(translated_text)} characters")
        
        # Use translated text for speech
        speech_text = translated_text
    else:
        # Use original text for speech
        speech_text = text
    
    # Get tone instructions
    instructions = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["neutral"])
    
    # Generate a unique filename
    filename = f"chunk_{uuid.uuid4()}.mp3"
    filepath = os.path.join('audio', filename)
    
    logger.info(f"Generating speech with voice={voice}, saving to {filepath}")
    
    # Create speech
    response = client.audio.speech.create(
        model="gpt-4o-mini-tts",
        voice=voice,
        input=speech_text,
        instructions=instructions
    )
    
    # Save the audio file
    with open(filepath, 'wb') as f:
        response.stream_to_file(filepath)
    
    logger.info(f"Speech generation complete, saved to {filepath}")
    
    # Return information about the processed chunk
    return {
        'original_text': original_text,
        'translated_text': translated_text,
        'audio_url': f'/audio/{filename}',
        'filename': filename
    }

@app.route('/get_all_processed_chunks', methods=['GET'])
def get_all_processed_chunks():
    """Get all processed chunks in the current session"""
    logger.info("Received request for all processed chunks")
    processed_chunks = session.get('processed_chunks', [])
    total_chunks = session.get('total_chunks', 0)
    current_chunk = session.get('current_chunk', 0)
    
    logger.info(f"Returning {len(processed_chunks)} processed chunks, total={total_chunks}, current={current_chunk}")
    return jsonify({
        'processed_chunks': processed_chunks,
        'total_chunks': total_chunks,
        'current_chunk': current_chunk
    })

@app.route('/audio/<filename>')
def serve_audio(filename):
    logger.info(f"Serving audio file: {filename}")
    response = send_from_directory('audio', filename)
    
    # Add additional CORS headers specifically for audio files
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Range')
    response.headers.add('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    response.headers.add('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type')
    response.headers.add('Cache-Control', 'no-cache')
    
    return response

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory('audio', filename, as_attachment=True)

@app.route('/chunk_text_only', methods=['POST'])
def chunk_text_only():
    """Chunk text without processing it and return the first chunk"""
    try:
        # Make session permanent
        session.permanent = True
        
        text = request.form.get('text', '')
        if not text:
            return jsonify({'error': 'No text provided'})
        
        print(f"Chunking text: {text[:100]}...")
        
        # Chunk the text
        text_chunks = chunk_text(text)
        
        print(f"Created {len(text_chunks)} chunks. First chunk: {text_chunks[0][:100]}...")
        
        # If there's only one chunk, return it directly
        if len(text_chunks) == 1:
            print("Returning single chunk")
            return jsonify({
                'is_chunked': False,
                'chunk': text_chunks[0]
            })
        
        # Otherwise, set up a session for retrieving chunks
        session_id = str(uuid.uuid4())
        
        # Store chunks in a temporary file to avoid session cookie size limits
        chunks_dir = os.path.join(tempfile.gettempdir(), 'text_chunks')
        os.makedirs(chunks_dir, exist_ok=True)
        
        # Save chunks to file
        chunks_file = os.path.join(chunks_dir, f"{session_id}.json")
        with open(chunks_file, 'w') as f:
            json.dump(text_chunks, f)
        
        # Store only metadata in session
        session['text_chunks_file'] = chunks_file
        session['text_current_chunk'] = 0
        session['text_total_chunks'] = len(text_chunks)
        session['text_session_id'] = session_id
        
        # Ensure the session is saved
        session.modified = True
        
        print(f"Created new text session: {session_id} with {len(text_chunks)} chunks")
        print(f"Chunks saved to file: {chunks_file}")
        print(f"Session keys: {list(session.keys())}")
        
        return jsonify({
            'is_chunked': True,
            'total_chunks': len(text_chunks),
            'session_id': session_id
        })
    except Exception as e:
        print(f"Error in chunk_text_only: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An error occurred: {str(e)}'})

@app.route('/get_next_text_chunk', methods=['POST'])
def get_next_text_chunk():
    """Get the next text chunk in sequence"""
    try:
        request_data = request.get_json() if request.is_json else {}
        requested_session_id = request_data.get('session_id')
        current_session_id = session.get('text_session_id')
        translate_to_chinese = request_data.get('translate_to_chinese', False)
        
        print(f"get_next_text_chunk called with session_id: {requested_session_id}")
        print(f"Current session ID in flask session: {current_session_id}")
        print(f"Current session keys: {list(session.keys())}")
        print(f"Translation requested: {translate_to_chinese}")
        
        # Get session data
        chunks_file = session.get('text_chunks_file')
        current_chunk_index = session.get('text_current_chunk', 0)
        total_chunks = session.get('text_total_chunks', 0)
        
        # Load chunks from file
        text_chunks = []
        if chunks_file and os.path.exists(chunks_file):
            with open(chunks_file, 'r') as f:
                text_chunks = json.load(f)
        
        print(f"Session data: chunks_file={chunks_file}, chunks={len(text_chunks) if text_chunks else 0}, current_index={current_chunk_index}, total={total_chunks}")
        
        # Check if session data exists
        if not text_chunks or current_chunk_index >= total_chunks:
            print(f"No more chunks or session expired. chunks={bool(text_chunks)}, index={current_chunk_index}, total={total_chunks}")
            return jsonify({'error': 'All chunks have been processed or session expired'})
        
        # Get the current chunk
        chunk = text_chunks[current_chunk_index]
        print(f"Retrieved chunk {current_chunk_index+1}/{total_chunks}: {chunk[:100]}...")
        
        # Translate to Chinese if requested
        translated_text = None
        if translate_to_chinese:
            print(f"Translating chunk {current_chunk_index+1} to Chinese")
            try:
                # Translate text to Chinese
                translation_response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a translator that translates text to Chinese. Provide only the translation without explanations."},
                        {"role": "user", "content": f"Translate the following text to Simplified Chinese:\n\n{chunk}"}
                    ],
                    temperature=0.3
                )
                
                translated_text = translation_response.choices[0].message.content
                print(f"Translation successful, result: {translated_text[:100]}...")
            except Exception as e:
                print(f"Translation error: {str(e)}")
                # Continue without translation if it fails
        
        # Increment the chunk index
        current_chunk_index += 1
        session['text_current_chunk'] = current_chunk_index
        
        # Save the session to ensure changes persist
        session.modified = True
        
        # Check if this is the last chunk
        is_last_chunk = current_chunk_index >= total_chunks
        
        response_data = {
            'chunk': chunk,
            'current_chunk': current_chunk_index,
            'total_chunks': total_chunks,
            'is_last_chunk': is_last_chunk
        }
        
        # Add translation if available
        if translated_text:
            response_data['translated_text'] = translated_text
        
        return jsonify(response_data)
    except Exception as e:
        print(f"Error in get_next_text_chunk: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An error occurred: {str(e)}'})

@app.route('/translate_text', methods=['POST'])
def translate_text():
    """Translate a piece of text to Chinese without affecting session state"""
    try:
        # Log the incoming request with more details
        logger.info("==================== /translate_text REQUEST RECEIVED ====================")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content-Type: {request.headers.get('Content-Type')}")
        logger.info(f"User-Agent: {request.headers.get('User-Agent')}")
        logger.info(f"Origin: {request.headers.get('Origin')}")
        
        # Get the text to translate
        request_data = request.get_json() if request.is_json else {}
        text = request_data.get('text', '')
        
        if not text:
            logger.error("No text provided for translation")
            return jsonify({'error': 'No text provided for translation'})
        
        logger.info(f"Translating text to Chinese: {text[:100]}...")
        
        # Translate the text
        translation_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a translator that translates text to Chinese. Provide only the translation without explanations."},
                {"role": "user", "content": f"Translate the following text to Simplified Chinese:\n\n{text}"}
            ],
            temperature=0.3
        )
        
        translated_text = translation_response.choices[0].message.content
        logger.info("Translation successful, result: {translated_text[:100]}...")
        
        return jsonify({
            'translated_text': translated_text
        })
    except Exception as e:
        print(f"Error in translate_text: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An error occurred during translation: {str(e)}'})

@app.route('/test_connection', methods=['GET', 'OPTIONS'])
def test_connection():
    """Simple endpoint to test if the server is running and accessible from the extension"""
    logger.info("==================== /test_connection REQUEST RECEIVED ====================")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Content-Type: {request.headers.get('Content-Type')}")
    logger.info(f"User-Agent: {request.headers.get('User-Agent')}")
    logger.info(f"Origin: {request.headers.get('Origin')}")
    
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    logger.info("Sending successful test_connection response")
    return jsonify({
        'status': 'success',
        'message': 'Connection to Podcast Maker server established successfully!',
        'timestamp': datetime.now().isoformat()
    })

def _build_cors_preflight_response():
    response = jsonify({})
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response

if __name__ == '__main__':
    logger.info("Starting Podcast Maker server on port 9092")
    app.run(host='0.0.0.0', port=9092, debug=True) 