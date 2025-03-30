// This script runs in the background
chrome.runtime.onInstalled.addListener(() => {
  // Set default options
  chrome.storage.sync.set({
    voice: 'nova',
    tone: 'friendly',
    chinese: true  // Always default to Chinese translation
  }, function() {
    console.log('Default settings saved with Chinese translation enabled by default');
  });

  // Add a context menu item for selected text
  chrome.contextMenus.create({
    id: "convertToSpeech",
    title: "Convert to Speech with VoiceText Pro",
    contexts: ["selection"]
  });
});

// Background script for VoiceText Pro
console.log('VoiceText Pro background script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSelectedText') {
    sendResponse({ success: true });
    return true;
  }
  
  // Handle text replacement requests from popup
  if (message.action === 'replaceSelectedText') {
    console.log('Background script received replace text request:', message.translatedText.substring(0, 30) + '...');
    
    // Execute content script to replace text in active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        
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
          args: [message.translatedText]
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error('Error executing script:', chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message
            });
            return;
          }
          
          console.log('Script execution results:', results);
          if (results && results[0]) {
            sendResponse(results[0].result);
          } else {
            sendResponse({
              success: false,
              error: 'Unknown error during text replacement'
            });
          }
        });
      } else {
        sendResponse({
          success: false,
          error: 'No active tab found'
        });
      }
    });
    
    return true; // Indicate we'll send response asynchronously
  }
});

// Handle context menu click - Simplified version
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked with text:', info.selectionText ? info.selectionText.substring(0, 30) + '...' : 'No text');
  
  if (info.menuItemId === "convertToSpeech" && info.selectionText && tab && tab.id) {
    console.log('Processing context menu action for tab:', tab.id);
    
    // Store the selected text and open popup
    try {
      chrome.storage.local.set({
        contextMenuSelection: {
          text: info.selectionText,
          tabId: tab.id,
          timestamp: Date.now()
        }
      }, () => {
        console.log('Stored selection in local storage');
        
        try {
          // First focus the tab
          chrome.tabs.update(tab.id, {active: true}, () => {
            console.log('Tab focused, now opening popup');
            
            // Then try to open the popup
            try {
              chrome.action.openPopup();
              console.log('Popup opened successfully');
            } catch (popupError) {
              console.error('Error opening popup:', popupError);
              
              // Fallback: Send a message to any open popup
              chrome.runtime.sendMessage({
                action: 'processSelectedText',
                text: info.selectionText,
                tabId: tab.id
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Error sending message:', chrome.runtime.lastError);
                } else {
                  console.log('Message sent successfully, response:', response);
                }
              });
            }
          });
        } catch (tabError) {
          console.error('Error focusing tab:', tabError);
        }
      });
    } catch (storageError) {
      console.error('Error storing selection:', storageError);
    }
  }
});

// Show error notification
function showErrorNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: 'VoiceText Pro Error',
    message: message,
    priority: 2
  });
} 