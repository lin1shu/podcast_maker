import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    """Base configuration class"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'podcast_maker_secret_key_fixed')
    UPLOAD_FOLDER = 'static/audio'
    MONGODB_HOST = os.getenv('MONGODB_HOST', 'localhost')
    MONGODB_PORT = int(os.getenv('MONGODB_PORT', 27017))
    MONGODB_USER = os.getenv('MONGODB_USER', 'admin')
    MONGODB_PASSWORD = os.getenv('MONGODB_PASSWORD', 'password')
    MONGODB_DB = os.getenv('MONGODB_DB', 'podcast_maker_db')
    
    # OpenAI API configuration
    @staticmethod
    def load_openai_key():
        """Load OpenAI API key from config.json or environment variables"""
        if os.path.exists('config.json'):
            with open('config.json', 'r') as f:
                config_data = json.load(f)
                return config_data.get("api_key")
        return os.environ.get("OPENAI_API_KEY")
    
    OPENAI_API_KEY = load_openai_key.__func__()
    
    # Audio processing settings
    MAX_TOKEN_LENGTH = 2000
    
    # Voice and tone settings
    AVAILABLE_VOICES = [
        "alloy", "echo", "fable", "onyx", "nova", "shimmer"
    ]
    
    AVAILABLE_TONES = [
        "neutral", "warm", "professional", "enthusiastic", 
        "calm", "formal", "informal", "serious", "friendly"
    ]
    
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


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = False  # Changed from True to False to avoid auto-restarts
    TESTING = False


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    # Use a test database
    MONGODB_DB = 'podcast_maker_test_db'


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    # In production, ensure SECRET_KEY is set from environment
    SECRET_KEY = os.getenv('SECRET_KEY')
    # Add any production-specific configurations here


# Dictionary mapping config name to config class
config_dict = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    
    # Default configuration
    'default': DevelopmentConfig
} 