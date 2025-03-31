# Podcast Maker

A web application that converts text to speech with optional Chinese translation using OpenAI's TTS API. Features a modular Flask architecture and MongoDB for data storage.

## Features

- Convert text to speech with multiple voice options
- Translate text to Chinese with proper formatting
- Store text and audio in MongoDB for easy retrieval
- View all podcast entries in a responsive database browser
- Chrome extension for easy text selection and processing
- Source URL tracking for audio content

## Project Structure

```
podcast_maker/
├── app/                    # Main application package
│   ├── config/            # Configuration management
│   ├── models/            # Data models
│   ├── routes/            # Route handlers
│   ├── services/          # Business logic and services
│   ├── static/            # Static files
│   ├── templates/         # HTML templates
│   └── utils/             # Utility functions
├── chrome_extension/      # Chrome extension files
├── audio/                 # Audio file storage
├── requirements.txt       # Python dependencies
├── run.py                # Application entry point
└── restart_server.sh     # Server management script
```

## Setup

### Prerequisites

- Python 3.8+
- Docker (for MongoDB)
- OpenAI API key
- Chrome browser (for extension)

### Installation

1. Clone the repository
2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set up MongoDB using Docker:
   ```
   docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest
   ```
4. Configure your environment:
   - Copy `.env.example` to `.env`
   - Update `.env` with your settings:
     ```
     FLASK_ENV=development
     PORT=9090
     SECRET_KEY=your_secret_key_here
     MONGODB_HOST=localhost
     MONGODB_PORT=27017
     MONGODB_USER=admin
     MONGODB_PASSWORD=password
     MONGODB_DB=podcast_maker_db
     OPENAI_API_KEY=your_openai_api_key_here
     ```

### Running the application

1. Start the Flask application:
   ```
   ./restart_server.sh
   ```
2. Access the web interface at `http://localhost:9090`
3. Check `app_output.log` for server logs

## MongoDB Integration

The application uses MongoDB to store:
- Original text (English)
- Translated text (Chinese, with proper formatting)
- Audio files (as binary data)
- Metadata (creation timestamps, voice settings, source URLs)

### Database Management Tools

1. **Connection Check**:
   ```
   python check_mongodb.py
   ```

2. **Import Existing Data**:
   ```
   python import_audio_to_mongodb.py
   ```

3. **Cleanup Utility**:
   ```
   # Show what would be removed (dry run)
   python cleanup_duplicates.py --dry-run
   
   # Remove duplicates
   python cleanup_duplicates.py
   
   # Analyze the database
   python cleanup_duplicates.py --analyze
   ```

### Database Viewer

Access the podcast database viewer at `http://localhost:9090/podcast/list` to:
- View all entries with playable audio
- See original and translated text
- Track source URLs
- View creation timestamps

## API Endpoints

- `/`: Main page
- `/podcast/list`: Database viewer
- `/api/podcast/history`: Get all podcast records (JSON)
- `/audio/get_podcast_audio/<chunk_id>`: Get audio file
- `/api/translate`: Translate text to Chinese
- `/api/process`: Process text to speech

## Chrome Extension

The Chrome extension allows you to:
1. Select text on any webpage
2. Convert it to speech directly
3. Automatically capture the source URL
4. Access the audio in the database viewer

### Installing the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome_extension` directory

## Configuration

The application supports multiple environments:
- Development (default)
- Testing
- Production

Configuration is managed through:
1. Environment variables
2. `.env` file
3. Config classes in `app/config/config.py`

## License

MIT 