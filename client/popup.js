// Popup uses background service worker's WebSocket connection

let currentUser = null;

// DOM Elements
const authSection = document.getElementById('authSection');
const gameSection = document.getElementById('gameSection');
const loadingSection = document.getElementById('loadingSection');
const usernameInput = document.getElementById('usernameInput');
const verifyBtn = document.getElementById('verifyBtn');
const displayUsername = document.getElementById('displayUsername');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const randomMatchBtn = document.getElementById('randomMatchBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const statusDiv = document.getElementById('statusDiv');
const errorDiv = document.getElementById('errorDiv');
const errorText = document.getElementById('errorText');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  setupEventListeners();
  setupMessageListener();
});

function setupEventListeners() {
  verifyBtn.addEventListener('click', verifyUser);
  logoutBtn.addEventListener('click', logout);
  randomMatchBtn.addEventListener('click', findRandomMatch);
  createRoomBtn.addEventListener('click', createPrivateRoom);
  joinRoomBtn.addEventListener('click', joinRoom);
  
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyUser();
  });
  
  roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

// Listen for messages from background
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Popup received message:', request);
    
    if (request.type === 'server_message') {
      handleServerMessage(request.messageType, request.data);
    }
    
    sendResponse({ received: true });
    return true;
  });
}

// Load saved user
async function loadUser() {
  const result = await chrome.storage.local.get(['cfUsername']);
  if (result.cfUsername) {
    currentUser = result.cfUsername;
    showGameSection();
    
    // Check WebSocket status
    chrome.runtime.sendMessage({ type: 'ws_status' }, (response) => {
      console.log('WebSocket status:', response);
    });
  }
}

// Verify Codeforces username
async function verifyUser() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showError('Please enter a username');
    return;
  }
  
  const originalText = verifyBtn.innerHTML;
  verifyBtn.innerHTML = '<span class="icon">⏳</span><span>Verifying...</span>';
  verifyBtn.disabled = true;
  
  try {
    const response = await fetch(`https://codeforces.com/api/user.info?handles=${username}`);
    const data = await response.json();
    
    if (data.status === 'OK') {
      await chrome.storage.local.set({ cfUsername: username });
      currentUser = username;
      hideError();
      
      // Connect WebSocket through background
      chrome.runtime.sendMessage({ 
        type: 'connect_ws',
        username: username
      }, (response) => {
        console.log('WebSocket connection initiated:', response);
        showGameSection();
      });
    } else {
      showError('User not found on Codeforces');
    }
  } catch (error) {
    showError('Failed to verify. Check your connection.');
  } finally {
    verifyBtn.innerHTML = originalText;
    verifyBtn.disabled = false;
  }
}

// Show game section
function showGameSection() {
  authSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  displayUsername.textContent = currentUser;
  userAvatar.textContent = currentUser.charAt(0).toUpperCase();
}

// Logout
async function logout() {
  await chrome.storage.local.remove(['cfUsername']);
  
  // Disconnect WebSocket
  chrome.runtime.sendMessage({ type: 'disconnect_ws' });
  
  currentUser = null;
  gameSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  usernameInput.value = '';
  hideError();
  hideStatus();
}

// Send message through background WebSocket
function sendWebSocketMessage(data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'send_ws',
      data: data
    }, (response) => {
      if (response && response.success) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Failed to send message'));
      }
    });
  });
}

// Find random match
async function findRandomMatch() {
  try {
    gameSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    
    await sendWebSocketMessage({
      type: 'find_match',
      username: currentUser
    });
  } catch (error) {
    showError('Not connected to server');
    loadingSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
  }
}

// Create private room
async function createPrivateRoom() {
  try {
    await sendWebSocketMessage({
      type: 'create_room',
      username: currentUser
    });
    
    showStatus('Creating private room...', 'warning');
  } catch (error) {
    showError('Not connected to server');
  }
}

// Join room
async function joinRoom() {
  const roomCode = roomCodeInput.value.trim();
  
  if (!roomCode) {
    showError('Please enter a room code');
    return;
  }
  
  try {
    await sendWebSocketMessage({
      type: 'join_room',
      username: currentUser,
      roomCode: roomCode
    });
    
    showStatus('Joining room...', 'warning');
  } catch (error) {
    showError('Not connected to server');
  }
}

// Handle server messages
function handleServerMessage(type, data) {
  console.log('Handling message type:', type);
  
  switch (type) {
    case 'match_found':
      loadingSection.classList.add('hidden');
      gameSection.classList.remove('hidden');
      showStatus(`🎯 Match found!\nOpponent: ${data.opponent}\nPrepare to battle...`, 'success');
      break;
      
    case 'room_created':
      roomCodeInput.value = data.roomCode;
      showStatus(`✅ Room created!\nCode: ${data.roomCode}\n\nShare this code with your opponent`, 'success');
      break;
      
    case 'room_joined':
      showStatus('✅ Room joined!\nWaiting for match to start...', 'success');
      break;
      
    case 'match_start':
      showStatus(
        `🚀 Battle Started!\n\nProblem: ${data.problem.contestId}${data.problem.index}\nOpponent: ${data.opponent}\n\nFirst correct submission wins!`,
        'success'
      );
      break;
      
    case 'submission_update':
      showStatus(`📝 ${data.username} submitted!\nVerdict: ${data.status}`, 'warning');
      break;
      
    case 'match_end':
      loadingSection.classList.add('hidden');
      gameSection.classList.remove('hidden');
      const isWinner = data.winner === currentUser;
      showStatus(
        isWinner ? '🎉 Victory!\nCheck the results page!' : '💪 Good fight!\nCheck the results page!',
        isWinner ? 'success' : 'warning'
      );
      setTimeout(() => hideStatus(), 3000);
      break;
      
    case 'error':
      showError(data.message);
      loadingSection.classList.add('hidden');
      gameSection.classList.remove('hidden');
      break;
  }
}

// Utility functions
function showStatus(message, type = '') {
  statusDiv.textContent = message;
  statusDiv.className = 'status-box';
  if (type) statusDiv.classList.add(type);
  statusDiv.classList.remove('hidden');
}

function hideStatus() {
  statusDiv.classList.add('hidden');
}

function showError(message) {
  errorText.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => hideError(), 4000);
}

function hideError() {
  errorDiv.classList.add('hidden');
}