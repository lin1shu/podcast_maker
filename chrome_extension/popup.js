// Global variables for DOM elements
let textArea, generateBtn, audioPlayer, downloadLink, wordCountSpan, statusDiv;
let translationArea, translateBtn, voiceSelect, toneSelect, chineseCheckbox;
let audioContainer, translationContainer;
let settingsToggle, settingsPanel, currentSettings, currentVoice, currentTone;
let lastTranslation = null; // Store the last translation result

// Global variable to track audio processing state
let isProcessingAudio = false;
let currentAudioElement = null;

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
  
  // Always set the Chinese checkbox to checked by default
  if (chineseCheckbox) {
    chineseCheckbox.checked = true;
    console.log('Chinese checkbox set to checked by default');
  }
  
  settingsToggle = document.getElementById('settings-toggle');
  console.log('settings-toggle element:', settingsToggle);
  
  settingsPanel = document.getElementById('settings-panel');
  console.log('settings-panel element:', settingsPanel);
  
  currentSettings = document.getElementById('current-settings');
  console.log('current-settings element:', currentSettings);
  
  currentVoice = document.getElementById('current-voice');
  console.log('current-voice element:', currentVoice);
  
  currentTone = document.getElementById('current-tone');
  console.log('current-tone element:', currentTone);
  
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
  chrome.storage.sync.get({
    voice: 'nova', 
    tone: 'friendly', 
    chinese: true, // Always default to Chinese translation enabled
    showSettings: false // Default to hiding settings
  }, function(items) {h
    if (items.voice) {
      voiceSelect.value = items.voice;
      // Update the current voice display
      updateCurrentSettingsDisplay();
    }
    
    if (items.tone) {
      toneSelect.value = items.tone;
      // Update the current tone display
      updateCurrentSettingsDisplay();
    }
    
    if (items.chinese !== undefined) {
      chineseCheckbox.checked = items.chinese;
    } else {
      // Force checkbox to be checked if not in settings
      chineseCheckbox.checked = true;
    }
    
    // Apply settings visibility preference
    if (items.showSettings !== undefined) {
      settingsPanel.style.display = items.showSettings ? 'block' : 'none';
    }
    
    console.log('Loaded stored settings:', items);
  });
}

// Update the current settings display
function updateCurrentSettingsDisplay() {
  // Get the selected voice and tone text
  const voiceText = voiceSelect.options[voiceSelect.selectedIndex].text;
  const toneText = toneSelect.options[toneSelect.selectedIndex].text;
  
  // Update the display
  currentVoice.textContent = voiceText;
  currentTone.textContent = toneText;
  
  console.log('Updated current settings display:', voiceText, toneText);
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
  
  // Settings toggle button
  settingsToggle.addEventListener('click', toggleSettings);
  
  // Make current settings display clickable to open settings
  currentSettings.addEventListener('click', function() {
    if (settingsPanel.style.display !== 'block') {
      toggleSettings();
    }
  });
  
  // Save settings when changed
  voiceSelect.addEventListener('change', function() {
    updateCurrentSettingsDisplay();
    saveSettings();
  });
  
  toneSelect.addEventListener('change', function() {
    updateCurrentSettingsDisplay();
    saveSettings();
  });
  
  chineseCheckbox.addEventListener('change', saveSettings);
  
  console.log('Event listeners set up');
}

// Toggle settings panel visibility
function toggleSettings() {
  console.log('Settings toggle clicked');
  const currentVisibility = settingsPanel.style.display === 'block';
  settingsPanel.style.display = currentVisibility ? 'none' : 'block';
  
  // Save the settings visibility preference
  chrome.storage.sync.set({ showSettings: !currentVisibility }, function() {
    console.log('Saved settings visibility preference:', !currentVisibility);
  });
}

// Save settings when changed
function saveSettings() {
  const settings = {
    voice: voiceSelect.value,
    tone: toneSelect.value,
    chinese: chineseCheckbox.checked,
    showSettings: settingsPanel.style.display === 'block'
  };
  
  // Make sure current settings display is updated
  updateCurrentSettingsDisplay();
  
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
        // Use scripting API for more reliable text selection retrieval
        chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          function: () => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            
            // If there's a selection, try to highlight it more prominently
            if (text && selection.rangeCount > 0) {
              try {
                // Make the selection more visible by applying a CSS class
                // This helps maintain focus on the selected text
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.className = 'voicetext-pro-selection';
                span.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                span.appendChild(range.extractContents());
                range.insertNode(span);
                
                // Reselect the text within the span
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);
              } catch (e) {
                console.error('Error highlighting selection:', e);
                // If highlighting fails, just return the text
              }
            }
            
            return text;
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
      showError('Cannot connect to VoiceText Pro server. Make sure it is running at http://192.168.4.106:9092');
    }
  };
  xhr.ontimeout = function() {
    console.error('XHR request timed out');
    showError('Connection to server timed out. Make sure it is running at http://192.168.4.106:9092');
  };
  xhr.onerror = function(e) {
    console.error('XHR request error:', e);
    showError('Cannot connect to VoiceText Pro server. Make sure it is running at http://192.168.4.106:9092');
  };
  console.log('Sending XHR request to test_connection...');
  xhr.send();
}

// Update word count
function updateWordCount(text) {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  wordCountSpan.textContent = words;
  
  // Since text area is hidden, also update the button text to show word count
  if (generateBtn) {
    generateBtn.textContent = words > 0 ? `Convert to Audio (${words} words)` : 'Convert to Audio';
  }
  
  console.log('Word count updated:', words);
}

// Check if we should show translation options
function checkForTranslation() {
  // For now, always show translation options
  translationArea.style.display = 'block';
}

// Handle translate button click
function handleTranslateClick() {
  console.log('Translate button clicked - starting translation process');
  
  // Don't interfere with ongoing audio generation
  if (isProcessingAudio) {
    console.log('Audio processing in progress, translation might interfere');
    showError('Please wait for current audio processing to complete');
    return;
  }
  
  const text = textArea.value.trim();
  
  if (!text) {
    showError('Please enter or select some text first.');
    return;
  }
  
  // Show processing message
  statusDiv.textContent = 'Translating...';
  statusDiv.className = 'status-message';
  statusDiv.style.display = 'block';
  
  // We're not going to stop audio here, as translation doesn't need to interrupt
  // audio playback, but we will make sure no new audio starts
  
  // Clear any existing translation
  translationContainer.innerHTML = '';
  translationContainer.style.display = 'none';
  
  // Reset last translation
  lastTranslation = null;
  
  console.log('Processing translation for text:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
  
  // Call the translation function - this will trigger text replacement and audio generation
  getTranslation(text);
}

// Handle generate button click
function handleGenerateClick() {
  console.log('Generate button clicked - VERBOSE DEBUG');
  
  // Prevent multiple simultaneous audio processing
  if (isProcessingAudio) {
    console.log('Already processing audio, ignoring new request');
    return;
  }
  
  isProcessingAudio = true;
  
  try {
    const text = textArea.value.trim();
    
    if (!text) {
      console.log('No text entered, showing error');
      showError('Please enter or select some text first.');
      isProcessingAudio = false;
      return;
    }
    
    console.log('Text found:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
    
    // Show processing message
    statusDiv.textContent = 'Generating audio...';
    statusDiv.className = 'status-message';
    statusDiv.style.display = 'block';
    
    // Clear existing audio and translation
    stopAllAudio();
    audioContainer.style.display = 'none';
    audioContainer.innerHTML = '';
    
    // Don't clear translation container if it already has content
    if (translationContainer.innerHTML.trim() === '') {
      translationContainer.style.display = 'none';
      translationContainer.innerHTML = '';
    }
    
    // Determine if this was triggered automatically after translation
    const isAfterTranslation = lastTranslation !== null && translationContainer.style.display === 'block';
    
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
      textLength: text.length,
      isAfterTranslation: isAfterTranslation
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
          
          if (data.error) {
            console.error('Server returned error:', data.error);
            showError('Error: ' + data.error);
            isProcessingAudio = false;
            return;
          }
          
          // Handle chunked responses
          if (data.is_chunked) {
            console.log('Chunked response detected, chunks:', data.total_chunks);
            // Just log it without showing a success message
            isProcessingAudio = false;
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
            // Show the audio player and start audio playback
            showAudioPlayer(fullAudioUrl, filename);
            
            // Hide the status message when audio is ready
            statusDiv.style.display = 'none';
            
            // If Chinese translation was requested and available, and we haven't already shown it
            if (requestData.is_chinese && data.chunk_info && data.chunk_info.translated_text && !isAfterTranslation) {
              showTranslation(data.chunk_info.original_text, data.chunk_info.translated_text);
              
              // If this wasn't triggered after translation, replace text on the page
              // Otherwise, text replacement was already done during translation
              replaceTextOnPage(data.chunk_info.translated_text);
            }
          } else {
            isProcessingAudio = false;
          }
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          showError('Error parsing server response. Check console for details.');
          isProcessingAudio = false;
        }
      } else {
        console.error('Server returned error status:', xhr.status);
        showError(`Server error: ${xhr.status} ${xhr.statusText}`);
        isProcessingAudio = false;
      }
    };
    
    xhr.ontimeout = function() {
      console.error('Request timed out');
      showError('Request timed out. The server might be busy or not responding.');
      isProcessingAudio = false;
    };
    
    xhr.onerror = function(e) {
      console.error('XHR request error:', e);
      showError('Network error. Make sure the server is running at http://192.168.4.106:9092');
      isProcessingAudio = false;
    };
    
    console.log('Sending process_chunk request...');
    xhr.send(JSON.stringify(requestData));
    
  } catch (e) {
    console.error('Exception in handleGenerateClick:', e);
    console.error('Stack trace:', e.stack);
    showError('Error: ' + e.message);
    isProcessingAudio = false;
  }
}

// Show translation in UI
function showTranslation(original, translated) {
  console.log('Showing translation:', translated.substring(0, 50) + (translated.length > 50 ? '...' : ''));
  
  // Clear previous content
  translationContainer.innerHTML = '';
  
  // Create translated text section
  const translatedDiv = document.createElement('div');
  translatedDiv.className = 'text-section translated';
  translatedDiv.style.padding = '10px';
  translatedDiv.style.backgroundColor = '#f9f9f9';
  translatedDiv.style.border = '1px solid #ddd';
  translatedDiv.style.borderRadius = '5px';
  translatedDiv.style.marginTop = '15px';
  
  const translatedLabel = document.createElement('div');
  translatedLabel.className = 'text-label';
  translatedLabel.textContent = 'Chinese Translation:';
  translatedLabel.style.fontWeight = 'bold';
  translatedLabel.style.marginBottom = '5px';
  
  const translatedContent = document.createElement('div');
  translatedContent.className = 'text-content';
  translatedContent.textContent = translated;
  translatedContent.style.lineHeight = '1.4';
  
  translatedDiv.appendChild(translatedLabel);
  translatedDiv.appendChild(translatedContent);
  
  // Add to container
  translationContainer.appendChild(translatedDiv);
  
  // Make sure the translation container is visible
  translationContainer.style.display = 'block';
  
  // Log visibility for debugging
  console.log('Translation container display style:', translationContainer.style.display);
  console.log('Translation content added to DOM');
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
        
        if (data.translated_text) {
          // Store the translation for potential use
          lastTranslation = {
            original: text,
            translated: data.translated_text
          };
          
          // Display the translation in the UI
          showTranslation(text, data.translated_text);
          
          // Hide the status message when translation is ready
          statusDiv.style.display = 'none';
          console.log('Translation displayed successfully');
          
          // First replace text on the page immediately
          replaceTextOnPage(data.translated_text);
          
          // Then automatically trigger audio generation
          setTimeout(() => {
            // Only generate audio if we're not already processing audio
            if (!isProcessingAudio && !currentAudioElement) {
              console.log('Automatically starting audio generation after translation');
              handleGenerateClick();
            }
          }, 500); // Short delay to ensure text replacement completes first
        } else {
          console.error('No translated text in response');
          showError('Translation error: No translated text received');
        }
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

// Function to replace text on the page
function replaceTextOnPage(translatedText) {
  console.log('Automatically replacing text on page with translation:', translatedText.substring(0, 30) + '...');
  
  // Get the active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      
      // Use direct script injection for more reliable text replacement
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        function: replaceSelectedTextInPage,
        args: [translatedText]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Error executing script:', chrome.runtime.lastError);
          showError('Error: Could not replace text - ' + chrome.runtime.lastError.message);
          return;
        }
        
        console.log('Script execution results:', results);
        if (results && results[0] && results[0].result && results[0].result.success) {
          console.log('Text replacement successful');
          showSuccess('Text replaced with Chinese translation');
          // Do not close the popup, keep it open for audio playback
        } else {
          const errorMsg = results?.[0]?.result?.error || 'No text selected or selection lost. Please select text again.';
          console.error('Text replacement failed:', errorMsg);
          showError('Could not replace text: ' + errorMsg);
        }
      });
    } else {
      showError('No active tab found');
    }
  });
}

// Function to be injected into the page to replace selected text
function replaceSelectedTextInPage(translatedText) {
  console.log('Content script replacing text with:', translatedText.substring(0, 30) + '...');
  
  // First, check if we have a highlighted selection from our extension
  const highlightedElement = document.querySelector('.voicetext-pro-selection');
  const selection = window.getSelection();
  
  // Store information about the selection
  const selectionInfo = {
    success: false,
    text: selection.toString().trim()
  };
  
  try {
    // Case 1: We have our highlighted span from the extension
    if (highlightedElement) {
      console.log('Found highlighted element from extension');
      
      // Replace the content of the highlighted span
      highlightedElement.textContent = translatedText;
      
      // Remove the highlighting but keep the text
      const parent = highlightedElement.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(translatedText), highlightedElement);
      }
      
      selectionInfo.success = true;
      return selectionInfo;
    }
    
    // Case 2: We still have a valid selection
    if (selection && selection.rangeCount > 0 && selectionInfo.text) {
      console.log('Using current selection');
      const range = selection.getRangeAt(0);
      
      // Delete the selected content
      range.deleteContents();
      
      // Create a text node with the replacement text
      const replacementNode = document.createTextNode(translatedText);
      
      // Insert the replacement text
      range.insertNode(replacementNode);
      
      // Collapse the selection to after the inserted node
      selection.collapseToEnd();
      
      selectionInfo.success = true;
    } else {
      selectionInfo.error = 'No valid text selection found';
    }
  } catch (error) {
    console.error('Error replacing text:', error);
    selectionInfo.error = error.message;
  }
  
  return selectionInfo;
}

// Show audio player
function showAudioPlayer(audioUrl, filename) {
  console.log('Creating audio player for URL:', audioUrl);
  
  // Stop all currently playing audio
  stopAllAudio();
  
  // Clear previous content
  audioContainer.innerHTML = '';
  
  // Create audio player HTML
  const audioHTML = `
    <div class="audio-player">
      <h3>Your Audio:</h3>
      <audio controls src="${audioUrl}" style="width: 100%; margin: 10px 0;" id="audio-element"></audio>
      <a href="${audioUrl}" download="${filename}" class="download-button">Download Audio</a>
    </div>
  `;
  
  // Set the HTML
  audioContainer.innerHTML = audioHTML;
  audioContainer.style.display = 'block';
  
  // Get the newly created audio element
  const audioElement = document.getElementById('audio-element');
  if (audioElement) {
    // Track the current audio element
    currentAudioElement = audioElement;
    isProcessingAudio = true; // Make sure we keep track that audio is active
    
    // Listen for when playback ends to reset our tracking
    audioElement.addEventListener('ended', function() {
      console.log('Audio playback ended naturally');
      currentAudioElement = null;
      isProcessingAudio = false;
    });
    
    // Listen for errors
    audioElement.addEventListener('error', function(e) {
      console.error('Audio playback error:', e);
      currentAudioElement = null;
      isProcessingAudio = false;
    });
    
    // Listen for pause
    audioElement.addEventListener('pause', function() {
      console.log('Audio playback paused');
      // Keep currentAudioElement reference but update processing state
      isProcessingAudio = false;
    });
    
    // Listen for play
    audioElement.addEventListener('play', function() {
      console.log('Audio playback started/resumed');
      isProcessingAudio = true;
    });
    
    // Start playback
    console.log('Starting audio playback');
    const playPromise = audioElement.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('Audio playback started successfully');
      }).catch(e => {
        console.error('Error playing audio:', e);
        // Don't reset currentAudioElement since the user may press play manually
        // Just update the processing state
        isProcessingAudio = false;
      });
    }
  }
}

// Function to stop all audio playback
function stopAllAudio() {
  console.log('Stopping all audio playback');
  
  // Stop the tracked current audio element if it exists
  if (currentAudioElement) {
    console.log('Stopping tracked audio element');
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
  
  // Also find and stop any other audio elements that might exist
  const allAudioElements = document.querySelectorAll('audio');
  if (allAudioElements.length > 0) {
    console.log(`Found ${allAudioElements.length} audio elements to stop`);
    allAudioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }
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