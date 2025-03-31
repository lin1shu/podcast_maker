# Podcast Maker

A Flask application for creating podcast-like audio content from text using OpenAI's text-to-speech APIs.

## Project Structure

The project has been refactored for better maintainability and scalability:

```
podcast_maker/
├── app/                        # Main application package
│   ├── __init__.py             # Application factory
│   ├── config/                 # Configuration settings
│   │   ├── __init__.py
│   │   └── config.py           # Environment-specific configs
│   ├── models/                 # Data models
│   │   └── __init__.py
│   ├── routes/                 # Route definitions (blueprints)
│   │   ├── __init__.py
│   │   ├── main.py             # Main routes
│   │   ├── podcast.py          # Podcast-related routes
│   │   ├── audio.py            # Audio handling routes
│   │   └── api.py              # API endpoints
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── database.py         # Database operations
│   │   └── audio_processor.py  # Audio processing logic
│   └── utils/                  # Utility functions
│       └── __init__.py
├── static/                     # Static files (CSS, JS, etc.)
│   ├── css/
│   ├── js/
│   └── audio/                  # Storage for audio files
├── templates/                  # HTML templates
│   ├── index.html
│   └── podcast_list.html
├── audio/                      # Audio output directory
├── venv/                       # Virtual environment
├── run.py                      # Application entry point
├── config.json                 # API key configuration
└── requirements.txt            # Package dependencies
```

## Features

- Text-to-speech conversion using OpenAI API
- Text chunking to handle large inputs
- Multiple voice options
- Different tone settings (neutral, enthusiastic, etc.)
- Podcast history and playback
- Text translation capabilities
- MongoDB integration for storage

## Setup Instructions

1. Clone the repository
2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure your OpenAI API key:
   - Create a `config.json` file with your API key:
     ```json
     {
       "api_key": "your-openai-api-key"
     }
     ```
   - Or set an environment variable: `OPENAI_API_KEY`

5. Make sure MongoDB is running:
   ```
   mongodb://admin:password@localhost:27017/
   ```

6. Run the application:
   ```
   python run.py
   ```

7. Access the application at http://localhost:5000

## Environment Variables

- `FLASK_ENV`: Application environment (development, testing, production)
- `PORT`: Port to run the application (default: 5000)
- `OPENAI_API_KEY`: OpenAI API key (if not using config.json)
- `MONGODB_HOST`: MongoDB host (default: localhost)
- `MONGODB_PORT`: MongoDB port (default: 27017)
- `MONGODB_USER`: MongoDB username (default: admin)
- `MONGODB_PASSWORD`: MongoDB password (default: password)
- `MONGODB_DB`: MongoDB database name (default: podcast_maker_db)

## API Endpoints

- `/api/process_chunk` - Process a chunk of text to generate audio
- `/api/chunk_text_only` - Split text into chunks without generating audio
- `/api/get_next_text_chunk` - Get the next text chunk from session
- `/api/get_all_processed_chunks` - Get all processed chunks
- `/api/translate_text` - Translate text to another language
- `/api/test_connection` - Test API connectivity

## License

[Your License] 