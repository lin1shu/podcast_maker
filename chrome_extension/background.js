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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSelectedText') {
    sendResponse({ success: true });
  }
}); 