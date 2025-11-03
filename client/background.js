// Background service worker for handling notifications and persistent connections

console.log('CF 1v1 Arena background service worker started');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'match_end') {
    handleMatchEnd(request);
  }
});

function handleMatchEnd(data) {
  // Show browser notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: data.won ? 'You Won! 🎉' : 'Match Ended',
    message: data.message,
    priority: 2
  });
  
  // Send to content script if on CF page
  chrome.tabs.query({ url: 'https://codeforces.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'match_end',
        won: data.won,
        message: data.message
      }).catch(() => {
        // Tab might not have content script, ignore
      });
    });
  });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    chrome.tabs.create({ url: 'popup.html' });
  }
});