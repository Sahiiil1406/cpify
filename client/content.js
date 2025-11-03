// Content script to track submissions on Codeforces problem pages

console.log('CF 1v1 Arena content script loaded');

// Check if user is in an active match
chrome.storage.local.get(['activeMatch', 'cfUsername'], (result) => {
  if (result.activeMatch && result.cfUsername) {
    const match = result.activeMatch;
    
    // Display match banner
    displayMatchBanner(match);
    
    // Monitor submit button
    monitorSubmitButton();
  }
});

function displayMatchBanner(match) {
  const banner = document.createElement('div');
  banner.id = 'cf-1v1-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px;
    text-align: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  
  const timeElapsed = Math.floor((Date.now() - match.startTime) / 1000);
  
  banner.innerHTML = `
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
      ⚔️ 1v1 MATCH IN PROGRESS
    </div>
    <div style="font-size: 14px;">
      Problem: ${match.problem.contestId}${match.problem.index} | 
      Opponent: ${match.opponent} | 
      Time: <span id="cf-match-timer">${timeElapsed}s</span>
    </div>
    <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">
      First to submit correct solution wins!
    </div>
  `;
  
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Update timer every second
  setInterval(() => {
    const timer = document.getElementById('cf-match-timer');
    if (timer) {
      const elapsed = Math.floor((Date.now() - match.startTime) / 1000);
      timer.textContent = `${elapsed}s`;
    }
  }, 1000);
  
  // Adjust page content to not overlap with banner
  const paddingDiv = document.createElement('div');
  paddingDiv.style.height = '80px';
  document.body.insertBefore(paddingDiv, document.body.firstChild.nextSibling);
}

function monitorSubmitButton() {
  // Find the submit button
  const submitButtons = document.querySelectorAll('input[type="submit"]');
  
  submitButtons.forEach(button => {
    if (button.value.toLowerCase().includes('submit')) {
      button.addEventListener('click', () => {
        console.log('Submission detected!');
        
        // Show notification
        showNotification('Submission sent! Waiting for verdict...');
        
        // Start checking for result
        setTimeout(checkSubmissionResult, 3000);
      });
    }
  });
}

function checkSubmissionResult() {
  // This would be enhanced to actually check the submission status
  // For now, we'll rely on the backend server to monitor via API
  console.log('Checking submission result...');
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: white;
    color: #333;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 10001;
    font-family: Arial, sans-serif;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'match_end') {
    const banner = document.getElementById('cf-1v1-banner');
    if (banner) {
      banner.style.background = request.won ? 
        'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 
        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      banner.innerHTML = `
        <div style="font-size: 24px; font-weight: bold;">
          ${request.won ? '🎉 YOU WON!' : '😔 YOU LOST'}
        </div>
        <div style="font-size: 14px; margin-top: 5px;">
          ${request.message}
        </div>
      `;
      
      setTimeout(() => {
        banner.style.animation = 'slideOut 0.5s ease-out';
        setTimeout(() => banner.remove(), 500);
      }, 5000);
    }
  }
});

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);