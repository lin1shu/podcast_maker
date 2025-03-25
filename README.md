# Podcast Maker

A Python 3.12 web application that converts text to speech using OpenAI's gpt-4o-mini-tts API.

## Features

- Convert text to speech using OpenAI's latest gpt-4o-mini-tts model
- Choose from multiple voice options provided by OpenAI
- Customize the speaking tone (warm, professional, enthusiastic, etc.)
- Play audio directly in the browser
- Download the generated MP3 file

## Setup

1. Ensure Python 3.12 is installed:
   ```
   python --version
   ```

2. Set up a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure your OpenAI API key:
   
   **Option 1 - Using the setup script (Recommended):**
   Run the provided setup script which will guide you through the process:
   ```bash
   ./setup_config.py
   ```
   This script will securely store your API key in your home directory and set appropriate file permissions.
   
   **Option 2 - Manual setup in home directory:**
   Create a config file in your home directory:
   ```bash
   echo '{"api_key": "your-openai-api-key-here"}' > ~/.podcast_maker_config.json
   chmod 600 ~/.podcast_maker_config.json  # Restrict permissions (Unix/Mac only)
   ```

   **Option 3 - Application directory:**
   Edit the `config.json` file in the application directory:
   ```json
   {
       "api_key": "your-openai-api-key-here"
   }
   ```

   The application will first look for the config file in your home directory, and if not found, it will check the local directory.

5. Run the web application using the launch script (recommended):
   ```
   ./launch.sh
   ```
   
   This script will automatically kill any process using port 9090 and start the application.

   Alternatively, you can run the app directly:
   ```
   python app.py
   ```

6. Open your browser and go to:
   ```
   http://127.0.0.1:9090
   ```

## Usage

1. Enter the text you want to convert to speech in the text area
2. Select a voice from the dropdown menu
3. Choose a tone for the speech (neutral, warm, professional, etc.)
4. Click "Convert to Speech"
5. Wait for the conversion to complete
6. The audio will play automatically
7. You can download the MP3 file using the "Download MP3" button

## API Key Configuration

Your OpenAI API key can be stored in one of two locations:

1. **Home directory (recommended)**: `~/.podcast_maker_config.json`
   - This keeps your API key outside of the application directory
   - Reduces the risk of accidentally committing your API key to version control
   - Can be secured with file permissions (chmod 600)
   - Use the `setup_config.py` script for easy setup

2. **Application directory**: `config.json` in the root of the application

The application will first check your home directory for the config file. If not found, it will look in the application directory.

## Voice Options

The application supports all standard voices available in OpenAI's TTS API:

- Alloy: Versatile, neutral voice
- Echo: High-clarity, crisp voice
- Fable: Expressive, narrative voice 
- Onyx: Deep, authoritative voice
- Nova: Warm, natural voice
- Shimmer: Clear, optimistic voice

## Tone Options

With the new gpt-4o-mini-tts model, you can customize how the voice speaks with different tones:

- Neutral: Standard, balanced tone
- Warm: Friendly, approachable tone
- Professional: Formal, business-like tone
- Enthusiastic: Excited, energetic tone
- Calm: Soothing, relaxed tone
- Formal: Structured, official tone
- Informal: Casual, conversational tone
- Serious: Grave, important tone
- Friendly: Kind, welcoming tone 