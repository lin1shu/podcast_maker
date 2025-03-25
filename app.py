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

app = Flask(__name__)
# Use a fixed secret key for session management
app.secret_key = "podcast_maker_secret_key_fixed"
# Set session to be permanent and last for 1 hour
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
app.config['SESSION_TYPE'] = 'filesystem'

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
    # If text is short enough, return it as is
    if num_tokens_from_string(text) <= max_tokens:
        return [text]
    
    # Split text by sentences
    sentences = re.split(SENTENCE_SPLIT_PATTERN, text)
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
            
            print(f"Created new session: {session_id} with {len(text_chunks)} chunks")
            
            # If there's only one chunk, process it immediately
            if len(text_chunks) == 1:
                chunk_info = process_single_chunk(text_chunks[0], voice, tone, is_chinese)
                return jsonify({
                    'is_chunked': False,
                    'total_chunks': 1,
                    'current_chunk': 1,
                    'chunk_info': chunk_info
                })
            
            # Otherwise, return info about chunking
            return jsonify({
                'is_chunked': True,
                'total_chunks': len(text_chunks),
                'session_id': session_id
            })
        
        # If it's not the first chunk, process the next chunk
        else:
            # Get session data
            chunks = session.get('chunks', [])
            voice = session.get('voice')
            tone = session.get('tone')
            current_chunk_index = session.get('current_chunk', 0)
            total_chunks = session.get('total_chunks', 0)
            is_chinese = session.get('is_chinese', False)
            processed_chunks = session.get('processed_chunks', [])
            
            # Debug logging
            print(f"Processing chunk {current_chunk_index+1}/{total_chunks}")
            
            # Check if session data exists
            if not chunks or current_chunk_index >= total_chunks:
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
            return jsonify({
                'current_chunk': current_chunk_index + 1,
                'total_chunks': total_chunks,
                'is_last_chunk': (current_chunk_index + 1 >= total_chunks),
                'chunk_info': chunk_info
            })
    
    except Exception as e:
        import traceback
        print(f"Error in process_chunk: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f"Error: {str(e)}"})

def process_single_chunk(text, voice, tone, is_chinese):
    """Process a single chunk of text - translating if needed and converting to speech"""
    # Default values
    original_text = text
    translated_text = None
    
    # If Chinese translation is requested
    if is_chinese:
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
    processed_chunks = session.get('processed_chunks', [])
    total_chunks = session.get('total_chunks', 0)
    current_chunk = session.get('current_chunk', 0)
    
    return jsonify({
        'processed_chunks': processed_chunks,
        'total_chunks': total_chunks,
        'current_chunk': current_chunk
    })

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory('audio', filename)

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory('audio', filename, as_attachment=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9090, debug=True) 