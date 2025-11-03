// Content script for modern match tracking UI on Codeforces

console.log('CF Arena content script loaded');

// Check if user is in an active match
chrome.storage.local.get(['activeMatch', 'cfUsername'], (result) => {
  if (result.activeMatch && result.cfUsername) {
    const match = result.activeMatch;
    displayMatchBanner(match);
    monitorSubmitButton();
  }
});

function displayMatchBanner(match) {
  // Create banner container
  const banner = document.createElement('div');
  banner.id = 'cf-1v1-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    z-index: 10000;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  
  const timeElapsed = Math.floor((Date.now() - match.startTime) / 1000);
  
  banner.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          backdrop-filter: blur(10px);
        ">⚔️</div>
        <div>
          <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.3px;">
            1v1 BATTLE IN PROGRESS
          </div>
          <div style="font-size: 13px; opacity: 0.95; font-weight: 500;">
            First correct submission wins • Problem ${match.problem.contestId}${match.problem.index}
          </div>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; gap: 20px;">
        <div style="text-align: center; padding: 12px 20px; background: rgba(255, 255, 255, 0.15); border-radius: 10px; backdrop-filter: blur(10px);">
          <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Opponent</div>
          <div style="font-size: 15px; font-weight: 700;">${match.opponent}</div>
        </div>
        
        <div style="text-align: center; padding: 12px 20px; background: rgba(255, 255, 255, 0.15); border-radius: 10px; backdrop-filter: blur(10px); min-width: 80px;">
          <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Time</div>
          <div style="font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums;" id="cf-match-timer">${formatTime(timeElapsed)}</div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Update timer
  setInterval(() => {
    const timer = document.getElementById('cf-match-timer');
    if (timer) {
      const elapsed = Math.floor((Date.now() - match.startTime) / 1000);
      timer.textContent = formatTime(elapsed);
    }
  }, 1000);
  
  // Add spacing to page content
  const spacer = document.createElement('div');
  spacer.style.height = '80px';
  spacer.id = 'cf-banner-spacer';
  document.body.insertBefore(spacer, document.body.firstChild.nextSibling);
  
  // Add CSS animations
  addStyles();
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function monitorSubmitButton() {
  const submitButtons = document.querySelectorAll('input[type="submit"], button[type="submit"]');
  
  submitButtons.forEach(button => {
    const buttonText = (button.value || button.textContent || '').toLowerCase();
    if (buttonText.includes('submit')) {
      button.addEventListener('click', () => {
        console.log('Submission detected');
        showToast('📤 Submission sent! Waiting for verdict...', 'info');
      });
    }
  });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    info: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  };
  
  toast.style.cssText = `
    position: fixed;
    top: 100px;
    right: 24px;
    background: ${colors[type]};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 10001;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 600;
    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    max-width: 320px;
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Listen for match end messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'match_end') {
    const banner = document.getElementById('cf-1v1-banner');
    if (banner) {
      const isWinner = request.won;
      const bgColor = isWinner 
        ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      
      banner.style.background = bgColor;
      banner.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 24px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">
            ${isWinner ? '🎉' : '💪'}
          </div>
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px;">
            ${isWinner ? 'VICTORY!' : 'GOOD FIGHT!'}
          </div>
          <div style="font-size: 15px; opacity: 0.95; font-weight: 500;">
            ${request.message}
          </div>
        </div>
      `;
      
      setTimeout(() => {
        banner.style.animation = 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        const spacer = document.getElementById('cf-banner-spacer');
        setTimeout(() => {
          banner.remove();
          if (spacer) spacer.remove();
        }, 400);
      }, 5000);
    }
  }
});

function addStyles() {
  if (document.getElementById('cf-arena-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'cf-arena-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes slideUp {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(-100%);
        opacity: 0;
      }
    }
    
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
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
}