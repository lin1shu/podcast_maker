// Global variables for DOM elements
let textArea, generateBtn, audioPlayer, downloadLink, wordCountSpan, statusDiv;
let translationArea, translateBtn, voiceSelect, toneSelect, chineseCheckbox;
let audioContainer, translationContainer;

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup initialized - DEBUG MODE');
  
  // Initialize elements
  initializeElements();
  
  // Test server connection
  testServerConnection();
  
  // Try to get selected text
  getSelectedText();
  
  // Add event listeners
  setupEventListeners();
  
  // DEBUG: Add direct console log for the button
  const convertButton = document.getElementById('convert-btn');
  console.log('Convert button found:', convertButton);
  
  // Add a direct event listener as a fallback
  if (convertButton) {
    console.log('Adding direct click handler to convert button');
    convertButton.addEventListener('click', function() {
      console.log('DIRECT HANDLER: Convert button clicked');
      handleGenerateClick();
    });
  } else {
    console.error('Convert button not found in the DOM');
  }
});

// Initialize elements
function initializeElements() {
  console.log('Initializing DOM elements - DEBUG MODE');
  
  // Get references to elements and log their values
  textArea = document.getElementById('text-input');
  console.log('text-input element:', textArea);
  
  generateBtn = document.getElementById('convert-btn');
  console.log('convert-btn element:', generateBtn);
  
  audioPlayer = document.getElementById('audio-player');
  console.log('audio-player element:', audioPlayer);
  
  downloadLink = document.getElementById('download-link');
  console.log('download-link element:', downloadLink);
  
  wordCountSpan = document.getElementById('word-count');
  console.log('word-count element:', wordCountSpan);
  
  statusDiv = document.getElementById('status-message');
  console.log('status-message element:', statusDiv);
  
  translationArea = document.getElementById('translation-area');
  console.log('translation-area element:', translationArea);
  
  translateBtn = document.getElementById('translate-btn');
  console.log('translate-btn element:', translateBtn);
  
  voiceSelect = document.getElementById('voice');
  console.log('voice element:', voiceSelect);
  
  toneSelect = document.getElementById('tone');
  console.log('tone element:', toneSelect);
  
  chineseCheckbox = document.getElementById('chinese');
  console.log('chinese element:', chineseCheckbox);
  
  // Add audio player container to the DOM if needed
  if (!document.getElementById('audio-container')) {
    audioContainer = document.createElement('div');
    audioContainer.id = 'audio-container';
    audioContainer.style.display = 'none';
    audioContainer.style.marginTop = '15px';
    document.querySelector('.container').appendChild(audioContainer);
  } else {
    audioContainer = document.getElementById('audio-container');
  }
  
  // Add translation container to the DOM if needed
  if (!document.getElementById('translation-container')) {
    translationContainer = document.createElement('div');
    translationContainer.id = 'translation-container';
    translationContainer.style.display = 'none';
    translationContainer.style.marginTop = '15px';
    document.querySelector('.container').appendChild(translationContainer);
  } else {
    translationContainer = document.getElementById('translation-container');
  }
  
  console.log('Elements initialized completely');
  
  // Load stored settings
  loadStoredSettings();
}

// Set default values from stored settings
function loadStoredSettings() {
  chrome.storage.sync.get(['voice', 'tone', 'chinese'], function(items) {
    if (items.voice) {
      voiceSelect.value = items.voice;
    }
    
    if (items.tone) {
      toneSelect.value = items.tone;
    }
    
    if (items.chinese !== undefined) {
      chineseCheckbox.checked = items.chinese;
    }
    
    console.log('Loaded stored settings:', items);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Add event listeners
  generateBtn.addEventListener('click', handleGenerateClick);
  
  textArea.addEventListener('input', function() {
    updateWordCount(textArea.value);
    checkForTranslation();
  });
  
  translateBtn.addEventListener('click', handleTranslateClick);
  
  // Save settings when changed
  voiceSelect.addEventListener('change', saveSettings);
  toneSelect.addEventListener('change', saveSettings);
  chineseCheckbox.addEventListener('change', saveSettings);
  
  console.log('Event listeners set up');
}

// Save settings when changed
function saveSettings() {
  const settings = {
    voice: voiceSelect.value,
    tone: toneSelect.value,
    chinese: chineseCheckbox.checked
  };
  
  chrome.storage.sync.set(settings, function() {
    console.log('Settings saved:', settings);
  });
}

// Get selected text from active tab
function getSelectedText() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      console.log('Getting selected text from tab:', activeTab.id);
      
      try {
        chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          function: function() {
            const selection = window.getSelection().toString().trim();
            console.log('Selected text in page:', selection);
            return selection;
          },
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error('Error executing script:', chrome.runtime.lastError);
            textArea.value = "Error: " + chrome.runtime.lastError.message;
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const selectedText = results[0].result;
            console.log('Selected text received:', selectedText);
            
            if (selectedText) {
              textArea.value = selectedText;
              updateWordCount(selectedText);
              checkForTranslation();
            } else {
              textArea.value = "No text selected. Select text on a webpage and try again, or type directly here.";
            }
          } else {
            console.warn('No results returned from executeScript');
          }
        });
      } catch (error) {
        console.error('Error executing script:', error);
        textArea.value = "Error: " + error.message;
      }
    } else {
      console.error('No active tab found');
      textArea.value = "Error: Could not access the active tab.";
    }
  });
}

// Test server connection
function testServerConnection() {
  console.log('Testing connection to server - VERBOSE DEBUG');
  
  // Show connecting message
  statusDiv.textContent = 'Connecting to server...';
  statusDiv.className = 'status-message';
  statusDiv.style.display = 'block';
  
  // Use XMLHttpRequest directly
  const xhr = new XMLHttpRequest();
  xhr.timeout = 5000; // 5 seconds timeout
  xhr.open('GET', 'http://192.168.4.106:9092/test_connection');
  xhr.onload = function() {
    console.log('XHR response received. Status:', xhr.status);
    console.log('XHR response text:', xhr.responseText);
    if (xhr.status === 200) {
      console.log('Server connection successful!');
      statusDiv.style.display = 'none';
    } else {
      console.error('XHR connection failed with status:', xhr.status);
      showError('Cannot connect to Podcast Maker server. Make sure it is running at http://192.168.4.106:9092');
    }
  };
  xhr.ontimeout = function() {
    console.error('XHR request timed out');
    showError('Connection to server timed out. Make sure it is running at http://192.168.4.106:9092');
  };
  xhr.onerror = function(e) {
    console.error('XHR request error:', e);
    showError('Cannot connect to Podcast Maker server. Make sure it is running at http://192.168.4.106:9092');
  };
  console.log('Sending XHR request to test_connection...');
  xhr.send();
}

// Update word count
function updateWordCount(text) {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  wordCountSpan.textContent = words;
  console.log('Word count updated:', words);
}

// Check if we should show translation options
function checkForTranslation() {
  // For now, always show translation options
  translationArea.style.display = 'block';
}

// Handle generate button click
function handleGenerateClick() {
  console.log('Generate button clicked - VERBOSE DEBUG');
  
  try {
    const text = textArea.value.trim();
    
    if (!text) {
      console.log('No text entered, showing error');
      showError('Please enter or select some text first.');
      return;
    }
    
    console.log('Text found:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
    
    // Show processing message
    statusDiv.textContent = 'Generating audio...';
    statusDiv.className = 'status-message';
    statusDiv.style.display = 'block';
    
    // Clear existing audio and translation
    audioContainer.style.display = 'none';
    audioContainer.innerHTML = '';
    translationContainer.style.display = 'none';
    translationContainer.innerHTML = '';
    
    // Gather settings
    const requestData = {
      text: text,
      voice: voiceSelect.value,
      tone: toneSelect.value,
      is_chinese: chineseCheckbox.checked,
      is_first_chunk: true
    };
    
    console.log('Sending request with settings:', {
      voice: requestData.voice,
      tone: requestData.tone,
      is_chinese: requestData.is_chinese,
      textLength: text.length
    });
    
    console.log('Full request data:', JSON.stringify(requestData).substring(0, 500));
    console.log('About to send to http://192.168.4.106:9092/process_chunk');
    
    // Use XMLHttpRequest directly for better error detection
    const xhr = new XMLHttpRequest();
    xhr.timeout = 30000; // 30 seconds timeout
    xhr.open('POST', 'http://192.168.4.106:9092/process_chunk');
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onload = function() {
      console.log('XHR response received. Status:', xhr.status);
      console.log('Response text:', xhr.responseText.substring(0, 500));
      
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          console.log('Audio generated successfully, parsed JSON:', JSON.stringify(data).substring(0, 500));
          showSuccess('Audio generated successfully!');
          
          if (data.error) {
            console.error('Server returned error:', data.error);
            showError('Error: ' + data.error);
            return;
          }
          
          // Handle chunked responses
          if (data.is_chunked) {
            console.log('Chunked response detected, chunks:', data.total_chunks);
            // For simplicity, we'll just notify the user that the text is being processed in chunks
            showSuccess(`Text is being processed in ${data.total_chunks} chunks. Check server logs for progress.`);
            return;
          }
          
          // For single chunk or completed chunks, show audio player
          const audioUrl = data.is_chunked ? null : data.chunk_info.audio_url;
          const filename = data.is_chunked ? null : data.chunk_info.filename;
          
          console.log('Audio URL:', audioUrl);
          console.log('Filename:', filename);
          
          // Update audio URL to use the IP address instead of localhost
          const fullAudioUrl = audioUrl ? `http://192.168.4.106:9092${audioUrl}` : null;
          console.log('Full audio URL:', fullAudioUrl);
          
          if (fullAudioUrl) {
            showAudioPlayer(fullAudioUrl, filename);
          }
          
          // If Chinese translation was requested and available, show it
          if (requestData.is_chinese && data.chunk_info && data.chunk_info.translated_text) {
            showTranslation(data.chunk_info.original_text, data.chunk_info.translated_text);
          }
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          showError('Error parsing server response. Check console for details.');
        }
      } else {
        console.error('Server returned error status:', xhr.status);
        showError(`Server error: ${xhr.status} ${xhr.statusText}`);
      }
    };
    
    xhr.ontimeout = function() {
      console.error('Request timed out');
      showError('Request timed out. The server might be busy or not responding.');
    };
    
    xhr.onerror = function(e) {
      console.error('XHR request error:', e);
      showError('Network error. Make sure the server is running at http://192.168.4.106:9092');
    };
    
    console.log('Sending process_chunk request...');
    xhr.send(JSON.stringify(requestData));
    
  } catch (e) {
    console.error('Exception in handleGenerateClick:', e);
    console.error('Stack trace:', e.stack);
    showError('Error: ' + e.message);
  }
}

// Handle translate button click
function handleTranslateClick() {
  console.log('Translate button clicked');
  const text = textArea.value.trim();
  
  if (!text) {
    showError('Please enter or select some text first.');
    return;
  }
  
  // Show processing message
  statusDiv.textContent = 'Translating...';
  statusDiv.className = 'status-message';
  statusDiv.style.display = 'block';
  
  getTranslation(text);
}

// Get translation from server
function getTranslation(text) {
  console.log('Getting translation for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  // Use XMLHttpRequest directly
  const xhr = new XMLHttpRequest();
  xhr.timeout = 30000; // 30 seconds timeout
  xhr.open('POST', 'http://192.168.4.106:9092/translate_text');
  xhr.setRequestHeader('Content-Type', 'application/json');
  
  xhr.onload = function() {
    console.log('Translation XHR response received. Status:', xhr.status);
    
    if (xhr.status === 200) {
      try {
        const data = JSON.parse(xhr.responseText);
        console.log('Translation received:', data);
        
        if (data.error) {
          console.error('Translation error:', data.error);
          showError('Translation error: ' + data.error);
          return;
        }
        
        showTranslation(text, data.translated_text);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        showError('Error parsing translation response');
      }
    } else {
      console.error('Translation request failed. Status:', xhr.status);
      showError('Translation error: Server returned ' + xhr.status);
    }
  };
  
  xhr.ontimeout = function() {
    console.error('Translation request timed out');
    showError('Translation request timed out');
  };
  
  xhr.onerror = function(e) {
    console.error('Translation XHR request error:', e);
    showError('Translation error: Network error');
  };
  
  console.log('Sending translation request...');
  xhr.send(JSON.stringify({ text: text }));
}

// Show translation in UI
function showTranslation(original, translated) {
  // Clear previous content
  translationContainer.innerHTML = '';
  
  // Create translated text section
  const translatedDiv = document.createElement('div');
  translatedDiv.className = 'text-section translated';
  
  const translatedLabel = document.createElement('div');
  translatedLabel.className = 'text-label';
  translatedLabel.textContent = 'Chinese Translation:';
  
  const translatedContent = document.createElement('div');
  translatedContent.className = 'text-content';
  translatedContent.textContent = translated;
  
  translatedDiv.appendChild(translatedLabel);
  translatedDiv.appendChild(translatedContent);
  
  // Add to container
  translationContainer.appendChild(translatedDiv);
  translationContainer.style.display = 'block';
}

// Show audio player
function showAudioPlayer(audioUrl, filename) {
  // Clear previous content
  audioContainer.innerHTML = '';
  
  // Create audio player HTML
  const audioHTML = `
    <div class="audio-player">
      <h3>Your Audio:</h3>
      <audio controls src="${audioUrl}" style="width: 100%; margin: 10px 0;"></audio>
      <a href="${audioUrl}" download="${filename}" class="download-button">Download Audio</a>
    </div>
  `;
  
  // Set the HTML
  audioContainer.innerHTML = audioHTML;
  audioContainer.style.display = 'block';
}

// Show error message
function showError(message) {
  console.error('Error:', message);
  statusDiv.textContent = message;
  statusDiv.className = 'status-message error';
  statusDiv.style.display = 'block';
}

// Show success message
function showSuccess(message) {
  console.log('Success:', message);
  statusDiv.textContent = message;
  statusDiv.className = 'status-message success';
  statusDiv.style.display = 'block';
}