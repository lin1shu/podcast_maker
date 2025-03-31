// Global variables for DOM elements
let textArea, generateBtn, audioPlayer, downloadLink, wordCountSpan, statusDiv;
let translationArea, translateBtn, voiceSelect, toneSelect, chineseCheckbox;
let audioContainer, translationContainer;
let settingsToggle, settingsPanel, currentSettings, currentVoice, currentTone;
let lastTranslation = null; // Store the last translation result
// Store the source URL
let currentSourceUrl = '';

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
  
  // Get current tab URL
  getCurrentTabUrl();
  
  // First, check for text from the simplified context menu selection
  chrome.storage.local.get('contextMenuSelection', function(data) {
    console.log('Checking for contextMenuSelection in storage, found:', data);
    
    try {
      if (data.contextMenuSelection) {
        const selection = data.contextMenuSelection;
        
        // Only use if the results are from the last minute (60000 ms)
        const isRecent = (Date.now() - selection.timestamp) < 60000;
        console.log('Selection timestamp:', selection.timestamp, 'Current time:', Date.now(), 'Is recent:', isRecent);
        
        if (isRecent && selection.text) {
          console.log('Found recent context menu selection:', selection);
          
          try {
            // Set the text in the text area
            textArea.value = selection.text;
            
            // Update word count
            updateWordCount(selection.text);
            
            // Store the tab ID for future reference
            const tabId = selection.tabId;
            console.log('Stored tab ID for replacement:', tabId);
            
            // Clear the stored selection so it's only used once
            chrome.storage.local.remove('contextMenuSelection', function() {
              console.log('contextMenuSelection removed from storage');
            });
            
            // Show a success message
            showSuccess('Text loaded from right-click menu');
            
            // Wait a short moment before starting translation
            setTimeout(() => {
              console.log('Starting automatic translation process');
              // Automatically trigger the translation and audio generation
              // This will trigger text replacement on the page too
              handleTranslateClick();
            }, 500);
            
            return; // Skip checking for other selections since we have results
          } catch (processError) {
            console.error('Error processing context menu selection:', processError);
            showError('Error processing selection: ' + processError.message);
          }
        } else {
          // Clear old selection
          chrome.storage.local.remove('contextMenuSelection', function() {
            console.log('Old contextMenuSelection removed from storage');
          });
        }
      }
    } catch (storageError) {
      console.error('Error accessing context menu selection from storage:', storageError);
      showError('Storage error: ' + storageError.message);
    }
    
    // If no context menu selection, check for other stored results
    chrome.storage.local.get('contextMenuResults', function(data) {
      if (data.contextMenuResults) {
        const results = data.contextMenuResults;
        
        // Only use if the results are from the last 10 minutes (600000 ms)
        const isRecent = (Date.now() - results.timestamp) < 600000;
        
        if (isRecent) {
          console.log('Found recent context menu results:', results);
          
          // Set the original text in the text area
          if (results.originalText) {
            textArea.value = results.originalText;
            updateWordCount(results.originalText);
          }
          
          // Display translation if available
          if (results.translatedText) {
            showAudioPlayer(results.audioUrl, results.filename);
            statusDiv.style.display = 'none';
          }
          
          // Replace text on the page if translated text is available
          if (results.translatedText && results.tabId) {
            console.log('Replacing text in tab ID:', results.tabId);
            
            // Use the stored tab ID for direct replacement
            chrome.scripting.executeScript({
              target: {tabId: results.tabId},
              func: function(translatedText) {
                console.log('Content script replacing text with:', translatedText);
                
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
                    
                    try {
                      // First try highlighting the selection to make it easier to track
                      let range = selection.getRangeAt(0);
                      const span = document.createElement('span');
                      span.className = 'voicetext-pro-selection';
                      span.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                      
                      // Extract contents and add to span
                      span.appendChild(range.extractContents());
                      range.insertNode(span);
                      
                      // Now replace the content immediately
                      span.textContent = translatedText;
                      
                      // Remove the highlighting but keep the text
                      const parent = span.parentNode;
                      if (parent) {
                        parent.replaceChild(document.createTextNode(translatedText), span);
                      }
                      
                      selectionInfo.success = true;
                      selectionInfo.method = 'highlight_then_replace';
                      return selectionInfo;
                    } catch (innerError) {
                      console.error('Error during highlight attempt:', innerError);
                      
                      // Fallback to direct replacement
                      try {
                        // Reset range in case it was modified
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
                        selectionInfo.method = 'direct_replacement';
                      } catch (fallbackError) {
                        console.error('Error during fallback replacement:', fallbackError);
                        selectionInfo.error = fallbackError.message;
                        selectionInfo.method = 'fallback_failed';
                      }
                    }
                  } else {
                    selectionInfo.error = 'No valid text selection found';
                    selectionInfo.method = 'no_selection';
                  }
                } catch (error) {
                  console.error('Error replacing text:', error);
                  selectionInfo.error = error.message;
                  selectionInfo.method = 'exception';
                }
                
                return selectionInfo;
              },
              args: [results.translatedText]
            }, (execResults) => {
              if (chrome.runtime.lastError) {
                console.error('Error executing script:', chrome.runtime.lastError);
                showError('Error: Could not replace text - ' + chrome.runtime.lastError.message);
              } else {
                console.log('Text replacement results:', execResults);
                if (execResults && execResults[0] && execResults[0].result && execResults[0].result.success) {
                  console.log('Text replacement successful');
                  showSuccess('Text replaced with Chinese translation');
                } else {
                  console.error('Text replacement failed:', execResults?.[0]?.result?.error || 'Unknown error');
                }
              }
            });
          }
          
          // Clear the results so they're only used once
          chrome.storage.local.remove('contextMenuResults');
          
          return; // Skip checking for selected text since we have results
        } else {
          // Clear old results
          chrome.storage.local.remove('contextMenuResults');
        }
      }
      
      // If no context menu results, check for text from context menu
      chrome.storage.local.get('selectedTextFromContextMenu', function(data) {
        if (data.selectedTextFromContextMenu) {
          console.log('Found text from context menu:', data.selectedTextFromContextMenu.substring(0, 30) + '...');
          
          // Set the text in the text area
          textArea.value = data.selectedTextFromContextMenu;
          
          // Update word count
          updateWordCount(data.selectedTextFromContextMenu);
          
          // Clear the stored text so it's only used once
          chrome.storage.local.remove('selectedTextFromContextMenu');
          
          // Automatically trigger the conversion
          handleGenerateClick();
        } else {
          // If no context menu text, get selected text from page as usual
          getSelectedText();
        }
      });
    });
  });
  
  // Add event listeners
  setupEventListeners();
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processSelectedText') {
      console.log('Received text to process:', message.text);
      // Set the text in the text area
      textArea.value = message.text;
      // Update word count
      updateWordCount(message.text);
      // Apply settings if provided
      if (message.settings) {
        voiceSelect.value = message.settings.voice;
        toneSelect.value = message.settings.tone;
        chineseCheckbox.checked = message.settings.chinese;
        // Update the display
        updateCurrentSettingsDisplay();
      }
      // Automatically trigger the conversion
      handleGenerateClick();
    }
  });
  
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
  }, function(items) {
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
          func: () => {
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
  
  console.log('Starting translation for text:', text.substring(0, 30) + '...');
  
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
    
    // Always hide translation container
    translationContainer.style.display = 'none';
    translationContainer.innerHTML = '';
    
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
    
    // Add source URL if available
    if (currentSourceUrl) {
      requestData.source_url = currentSourceUrl;
      console.log('Adding source URL to request:', currentSourceUrl);
    }
    
    console.log('Sending request with settings:', {
      voice: requestData.voice,
      tone: requestData.tone,
      is_chinese: requestData.is_chinese,
      textLength: text.length,
      isAfterTranslation: isAfterTranslation,
      source_url: requestData.source_url || 'not set'
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
          const jsonFilename = data.is_chunked ? null : data.chunk_info.json_filename;
          
          console.log('Audio URL:', audioUrl);
          console.log('Filename:', filename);
          console.log('JSON Filename:', jsonFilename);
          
          // Update audio URL to use the IP address instead of localhost
          const fullAudioUrl = audioUrl ? `http://192.168.4.106:9092${audioUrl}` : null;
          console.log('Full audio URL:', fullAudioUrl);
          
          // Update JSON URL to use the IP address
          const fullJsonUrl = jsonFilename ? `http://192.168.4.106:9092/text/${jsonFilename}` : null;
          console.log('Full JSON URL:', fullJsonUrl);
          
          if (fullAudioUrl) {
            // Show the audio player and start audio playback
            showAudioPlayer(fullAudioUrl, filename);
            
            // Store the JSON data URL for potential later use
            if (fullJsonUrl) {
              chrome.storage.local.set({ 'lastTextJsonUrl': fullJsonUrl });
            }
            
            // Hide the status message when audio is ready
            statusDiv.style.display = 'none';
            
            // Don't show the Chinese translation even if it's available
            // Keep the rest of the logic (like replacing text on page) but don't display in popup
            if (requestData.is_chinese && data.chunk_info && data.chunk_info.translated_text && !isAfterTranslation) {
              // Store the translation but don't display in popup
              showTranslation(data.chunk_info.original_text, data.chunk_info.translated_text);
              
              // Replace text on the page with the translation
              console.log('Replacing text on the page with translation from audio generation');
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
  console.log('Translation received but not showing in UI per user preference');
  
  // Store the translation for tracking purposes without displaying it in the UI
  lastTranslation = {
    original: original,
    translated: translated
  };
  
  // Always hide the translation container
  translationContainer.style.display = 'none';
  
  // Still replace text on the webpage (done by the caller)
  return translated;
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
          // Store the translation data but don't display in popup
          showTranslation(text, data.translated_text);
          
          // Hide the status message when translation is ready
          statusDiv.style.display = 'none';
          
          // First replace text on the page immediately
          console.log('Replacing text on the page with translation');
          replaceTextOnPage(data.translated_text);
          
          // Then automatically trigger audio generation after a short delay
          setTimeout(() => {
            // Only generate audio if we're not already processing audio
            if (!isProcessingAudio && !currentAudioElement) {
              console.log('Automatically starting audio generation after translation');
              handleGenerateClick();
            } else {
              console.log('Skipping automatic audio generation - already processing audio');
            }
          }, 1000); // Longer delay to ensure text replacement completes first
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
  
  // Include source URL in translation request as well
  const requestData = { text: text };
  if (currentSourceUrl) {
    requestData.source_url = currentSourceUrl;
    console.log('Adding source URL to translation request:', currentSourceUrl);
  }
  
  console.log('Sending translation request...');
  xhr.send(JSON.stringify(requestData));
}

// Function to replace text on the page
function replaceTextOnPage(translatedText) {
  console.log('Attempting to replace text on page with translation:', translatedText.substring(0, 30) + '...');
  
  // Get the active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      console.log('Found active tab for replacement:', activeTab.id);
      
      // Use direct script injection for more reliable text replacement
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        func: function(translatedText) {
          console.log('Content script replacing text with:', translatedText.substring(0, 30) + '...');
          
          // First, check if we have a highlighted selection from our extension
          const highlightedElement = document.querySelector('.voicetext-pro-selection');
          const selection = window.getSelection();
          
          // Store information about the selection
          const selectionInfo = {
            success: false,
            text: selection ? selection.toString().trim() : '',
            method: ''
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
              selectionInfo.method = 'highlighted_element';
              return selectionInfo;
            }
            
            // Case 2: We still have a valid selection
            if (selection && selection.rangeCount > 0 && selectionInfo.text) {
              console.log('Using current selection');
              
              try {
                // First try highlighting the selection to make it easier to track
                let range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.className = 'voicetext-pro-selection';
                span.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                
                // Extract contents and add to span
                span.appendChild(range.extractContents());
                range.insertNode(span);
                
                // Now replace the content immediately
                span.textContent = translatedText;
                
                // Remove the highlighting but keep the text
                const parent = span.parentNode;
                if (parent) {
                  parent.replaceChild(document.createTextNode(translatedText), span);
                }
                
                selectionInfo.success = true;
                selectionInfo.method = 'highlight_then_replace';
                return selectionInfo;
              } catch (innerError) {
                console.error('Error during highlight attempt:', innerError);
                
                // Fallback to direct replacement
                try {
                  // Reset range in case it was modified
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
                  selectionInfo.method = 'direct_replacement';
                } catch (fallbackError) {
                  console.error('Error during fallback replacement:', fallbackError);
                  selectionInfo.error = fallbackError.message;
                  selectionInfo.method = 'fallback_failed';
                }
              }
            } else {
              selectionInfo.error = 'No valid text selection found';
              selectionInfo.method = 'no_selection';
            }
          } catch (error) {
            console.error('Error replacing text:', error);
            selectionInfo.error = error.message;
            selectionInfo.method = 'exception';
          }
          
          return selectionInfo;
        },
        args: [translatedText]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Error executing script:', chrome.runtime.lastError);
          // Don't show error to user since text replacement might have actually succeeded
          // showError('Error: Could not replace text - ' + chrome.runtime.lastError.message);
          return;
        }
        
        console.log('Script execution results:', results);
        if (results && results[0] && results[0].result && results[0].result.success) {
          console.log('Text replacement successful using method:', results[0].result.method);
          showSuccess('Text replaced with Chinese translation');
        } else {
          const errorMsg = results?.[0]?.result?.error || 'No text selected or selection lost. Please select text again.';
          const method = results?.[0]?.result?.method || 'unknown';
          console.error('Text replacement failed with method:', method, 'Error:', errorMsg);
          
          // Don't show any message to the user
          // Just log the error for debugging
        }
      });
    } else {
      // Don't show error if tab is not found
      console.error('No active tab found');
    }
  });
}

// Function to show audio player
function showAudioPlayer(audioUrl, filename) {
  console.log('Showing audio player for:', audioUrl);
  stopAllAudio();
  
  if (!audioUrl) {
    console.error('No audio URL provided to showAudioPlayer');
    return;
  }
  
  // Clear any existing audio containers
  audioContainer.innerHTML = '';
  audioContainer.style.display = 'block';
  
  // Create the audio element
  const audioElement = document.createElement('audio');
  audioElement.controls = true;
  audioElement.src = audioUrl;
  audioElement.className = 'audio-player';
  audioElement.id = 'currentAudio';
  
  // Track this as the current audio element
  currentAudioElement = audioElement;
  
  // Add elements to container
  audioContainer.appendChild(audioElement);
  
  // Play the audio (this might fail due to browser autoplay policies)
  audioElement.play().catch(e => {
    console.log('Autoplay failed, user needs to click play:', e.message);
  });
  
  // Reset processing state
  isProcessingAudio = false;
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

// Get current tab URL
function getCurrentTabUrl() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0) {
      currentSourceUrl = tabs[0].url;
      console.log('Current tab URL captured as source URL:', currentSourceUrl);
    } else {
      console.warn('Could not get current tab URL');
    }
  });
}