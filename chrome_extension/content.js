// This script runs in the context of web pages
// It can interact with the DOM of the page

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
  }
  return true; // Indicates we will send a response asynchronously
});

// This script remains running in the background of the active tab
console.log("VoiceText Pro content script loaded"); 