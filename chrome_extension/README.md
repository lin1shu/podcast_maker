# Podcast Maker Chrome Extension

This Chrome extension allows you to convert selected text on any webpage into podcast-quality audio using OpenAI's text-to-speech technology.

## Features

- Select text on any webpage and convert it to audio
- Choose from multiple voice options
- Set different tones for the audio generation
- Optional translation to Chinese
- Handles large text by automatically chunking it

## Prerequisites

- Make sure the Podcast Maker Flask application is running on `http://localhost:9092`
- Chrome browser

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the `chrome_extension` folder
4. The extension should now appear in your extensions list and in the Chrome toolbar

## Usage

1. Select text on any webpage
2. Click the Podcast Maker extension icon in the toolbar
3. Choose your preferred voice and tone
4. Check the "Translate to Chinese" box if you want the text translated
5. Click "Convert to Audio"
6. Wait for processing to complete
7. The audio will open in a new tab automatically

## Required Permissions

- `activeTab`: To access the selected text on the current webpage
- `storage`: To save your voice and tone preferences

## Files

- `manifest.json`: Extension configuration
- `popup.html`: The extension popup UI
- `popup.css`: Styling for the popup
- `popup.js`: Main functionality for the popup
- `background.js`: Background script for handling events
- `content.js`: Content script for interacting with web pages

## Icons

The extension requires icon files in the following sizes:
- `images/icon16.png` (16x16 pixels)
- `images/icon48.png` (48x48 pixels)
- `images/icon128.png` (128x128 pixels)

You'll need to create these icons before publishing the extension.

## Development

For development and testing:
1. Make changes to the code as needed
2. Go to `chrome://extensions/`
3. Find this extension and click the refresh icon
4. Test your changes

## Note

This extension requires the Podcast Maker Flask API to be running locally at `http://localhost:9092`. If the API is running on a different host or port, update the URLs in `popup.js`. 