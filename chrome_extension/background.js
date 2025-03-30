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
});

// Background script for VoiceText Pro
console.log('VoiceText Pro background script loaded');

// Store the last selection for use between popup open/close
let lastSelection = {
  tabId: null,
  text: '',
  range: null
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSelectedText') {
    sendResponse({ success: true });
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
          function: replaceSelectedTextInPage,
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
        const fragment = document.createDocumentFragment();
        while (highlightedElement.firstChild) {
          fragment.appendChild(highlightedElement.firstChild);
        }
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