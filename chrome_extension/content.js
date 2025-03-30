// This script runs in the context of web pages
// It can interact with the DOM of the page

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
  }
  else if (request.action === 'replaceSelectedText') {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // Store information about the selection for later use
    const selectionInfo = {
      text: selection.toString().trim(),
      nodeType: selection.anchorNode.nodeType,
      success: false
    };
    
    try {
      // Only proceed if we have a valid selection
      if (selection.rangeCount > 0 && selectionInfo.text) {
        // Delete the selected content
        range.deleteContents();
        
        // Create a text node with the replacement text
        const replacementNode = document.createTextNode(request.translatedText);
        
        // Insert the replacement text
        range.insertNode(replacementNode);
        
        // Collapse the selection to after the inserted node
        selection.collapseToEnd();
        
        selectionInfo.success = true;
      }
    } catch (error) {
      console.error('Error replacing text:', error);
      selectionInfo.error = error.message;
    }
    
    sendResponse(selectionInfo);
  }
  return true; // Indicates we will send a response asynchronously
});

// This script remains running in the background of the active tab
console.log("VoiceText Pro content script loaded"); 