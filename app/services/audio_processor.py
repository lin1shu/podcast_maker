import pydub
import uuid
import os
import tiktoken
import re
import logging
from openai import OpenAI
from datetime import datetime

# Get logger
logger = logging.getLogger(__name__)

class AudioProcessor:
    def __init__(self, api_key, tone_instructions):
        """Initialize the audio processor with OpenAI API key and tone instructions"""
        self.client = OpenAI(api_key=api_key)
        self.tone_instructions = tone_instructions
        
    def num_tokens_from_string(self, string, model="gpt-4o"):
        """Returns the number of tokens in a text string."""
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(string))

    def chunk_text(self, text, max_tokens=2000):
        """
        Split text into chunks not exceeding max_tokens,
        breaking at sentence boundaries when possible.
        Uses tiktoken to accurately count tokens.
        """
        total_tokens = self.num_tokens_from_string(text)
        logger.info(f"Total tokens in input text: {total_tokens}")
        
        # If text is short enough, return it as is
        if total_tokens <= max_tokens:
            logger.info(f"Text is short enough ({total_tokens} tokens), returning as single chunk")
            return [text]
        
        # Pattern to split text at sentence boundaries
        sentence_split_pattern = r'(?<=[.!?])\s+'
        
        # Split text by sentences
        sentences = re.split(sentence_split_pattern, text)
        logger.info(f"Split into {len(sentences)} sentences")
        
        chunks = []
        current_chunk = ""
        current_tokens = 0
        
        for sentence in sentences:
            sentence_tokens = self.num_tokens_from_string(sentence)
            
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
                    word_tokens = self.num_tokens_from_string(word + " ")
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
        
        # Log token counts for each chunk
        for i, chunk in enumerate(chunks):
            chunk_tokens = self.num_tokens_from_string(chunk)
            logger.info(f"Chunk {i+1}/{len(chunks)}: {chunk_tokens} tokens")
        
        return chunks
    
    def generate_audio(self, text, voice="nova", tone="neutral", is_chinese=False):
        """Generate audio from text using OpenAI's Text-to-Speech API"""
        # Prepare system instructions based on tone and language
        system_instructions = self.tone_instructions.get(tone, self.tone_instructions["neutral"])
        if is_chinese:
            system_instructions += " Please speak in fluent Chinese with natural pronunciation."
        
        try:
            # Generate audio response
            response = self.client.audio.speech.create(
                model="tts-1-hd",
                voice=voice,
                input=text,
                response_format="mp3"
            )
            
            # Generate a unique filename
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            filename = f"{timestamp}_{uuid.uuid4()}.mp3"
            output_path = os.path.join('audio', filename)
            
            # Save the audio file
            with open(output_path, "wb") as f:
                f.write(response.content)
                
            return {
                "filename": filename,
                "path": output_path,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error generating audio: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def merge_audio_files(self, audio_files):
        """Merge multiple audio files into a single MP3 file"""
        try:
            combined = pydub.AudioSegment.empty()
            for file_path in audio_files:
                audio = pydub.AudioSegment.from_mp3(file_path)
                combined += audio
            
            # Generate a unique filename
            output_filename = f"{uuid.uuid4()}.mp3"
            output_path = os.path.join('audio', output_filename)
            combined.export(output_path, format="mp3")
            
            return {
                "filename": output_filename,
                "path": output_path,
                "success": True
            }
        except Exception as e:
            logger.error(f"Error merging audio files: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            } 