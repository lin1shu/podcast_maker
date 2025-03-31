# Podcast Maker

A web application that converts text to speech with optional Chinese translation using OpenAI's TTS API. Data is stored in MongoDB.

## Features

- Convert text to speech with multiple voice options
- Translate text to Chinese
- Store text and audio in MongoDB for easy retrieval
- View all podcast entries in a database browser

## Setup

### Prerequisites

- Python 3.8+
- Docker (for MongoDB)
- OpenAI API key

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
4. Set up your OpenAI API key:
   - Create a `config.json` file in the project root with the following content:
     ```json
     {
       "api_key": "your_openai_api_key_here"
     }
     ```

### Running the application

1. Start the Flask application:
   ```
   python app.py
   ```
2. Access the web interface at `http://localhost:9092`

## MongoDB Integration

The application uses MongoDB to store:
- Original text (English)
- Translated text (Chinese, when applicable)
- Audio files (as binary data)
- Metadata (creation timestamps, voice settings, etc.)

### Importing existing data

To import all audio files from the `audio` directory into MongoDB:

```
python import_audio_to_mongodb.py
```

### Managing duplicates

The application includes tools to prevent and clean up duplicate entries:

1. **Automatic duplicate prevention** - The application checks for existing content before processing new requests.

2. **Cleanup utility** - Use the cleanup script to find and remove duplicates:
   ```
   # Show what would be removed without making changes
   python cleanup_duplicates.py --dry-run
   
   # Actually remove duplicates
   python cleanup_duplicates.py
   
   # Just analyze the database without changes
   python cleanup_duplicates.py --analyze
   ```

### Viewing the database

Access the podcast database viewer at `http://localhost:9092/podcast_list` to see all entries with playable audio.

### MongoDB Connection Details

- Server: localhost:27017
- Database: podcast_maker_db
- Collection: podcasts
- Username: admin
- Password: password

## Usage

1. Enter text in the main page text area
2. Select a voice and tone
3. Click "Convert to Speech" or "Convert to Chinese Speech"
4. The audio will be generated and stored in MongoDB
5. View all your stored podcasts in the database viewer

## API Endpoints

- `/`: Main page
- `/podcast_list`: Database viewer for all podcast entries
- `/get_podcast_history`: JSON API to get all podcast records
- `/get_podcast_audio/<chunk_id>`: Get audio file for a specific entry
- `/translate_text`: Translate text to Chinese
- `/process_chunk`: Process text to speech

## License

MIT 