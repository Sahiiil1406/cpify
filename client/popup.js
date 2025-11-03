// Configuration
const WS_SERVER = 'ws://localhost:3000';

let ws = null;
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
});

function setupEventListeners() {
  verifyBtn.addEventListener('click', verifyUser);
  logoutBtn.addEventListener('click', logout);
  randomMatchBtn.addEventListener('click', findRandomMatch);
  createRoomBtn.addEventListener('click', createPrivateRoom);
  joinRoomBtn.addEventListener('click', joinRoom);
  
  // Enter key support
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyUser();
  });
  
  roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  // Auto-format room code
  roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

// Load saved user
async function loadUser() {
  const result = await chrome.storage.local.get(['cfUsername']);
  if (result.cfUsername) {
    currentUser = result.cfUsername;
    showGameSection();
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
      showGameSection();
      connectWebSocket();
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
  connectWebSocket();
}

// Logout
async function logout() {
  await chrome.storage.local.remove(['cfUsername']);
  if (ws) ws.close();
  currentUser = null;
  gameSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  usernameInput.value = '';
  hideError();
  hideStatus();
}

// WebSocket Connection
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  ws = new WebSocket(WS_SERVER);
  
  ws.onopen = () => {
    console.log('Connected to server');
    ws.send(JSON.stringify({
      type: 'register',
      username: currentUser
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };
  
  ws.onerror = () => {
    showError('Connection error. Is the server running?');
  };
  
  ws.onclose = () => {
    console.log('Disconnected from server');
    setTimeout(connectWebSocket, 3000);
  };
}

// Handle messages from server
function handleServerMessage(data) {
  switch (data.type) {
    case 'match_found':
      handleMatchFound(data);
      break;
    case 'room_created':
      handleRoomCreated(data);
      break;
    case 'room_joined':
      handleRoomJoined(data);
      break;
    case 'match_start':
      handleMatchStart(data);
      break;
    case 'submission_update':
      handleSubmissionUpdate(data);
      break;
    case 'match_end':
      handleMatchEnd(data);
      break;
    case 'error':
      showError(data.message);
      loadingSection.classList.add('hidden');
      gameSection.classList.remove('hidden');
      break;
  }
}

// Find random match
function findRandomMatch() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showError('Not connected to server');
    return;
  }
  
  gameSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  
  ws.send(JSON.stringify({
    type: 'find_match',
    username: currentUser
  }));
}

// Create private room
function createPrivateRoom() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showError('Not connected to server');
    return;
  }
  
  ws.send(JSON.stringify({
    type: 'create_room',
    username: currentUser
  }));
  
  showStatus('Creating private room...', 'warning');
}

// Join room
function joinRoom() {
  const roomCode = roomCodeInput.value.trim();
  
  if (!roomCode) {
    showError('Please enter a room code');
    return;
  }
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showError('Not connected to server');
    return;
  }
  
  ws.send(JSON.stringify({
    type: 'join_room',
    username: currentUser,
    roomCode: roomCode
  }));
  
  showStatus('Joining room...', 'warning');
}

// Handle match found
function handleMatchFound(data) {
  loadingSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  showStatus(`🎯 Match found!\nOpponent: ${data.opponent}\nPrepare to battle...`, 'success');
}

// Handle room created
function handleRoomCreated(data) {
  roomCodeInput.value = data.roomCode;
  showStatus(`✅ Room created!\nCode: ${data.roomCode}\n\nShare this code with your opponent`, 'success');
}

// Handle room joined
function handleRoomJoined(data) {
  showStatus('✅ Room joined!\nWaiting for match to start...', 'success');
}

// Handle match start
function handleMatchStart(data) {
  chrome.storage.local.set({ 
    activeMatch: {
      matchId: data.matchId,
      problem: data.problem,
      opponent: data.opponent,
      startTime: Date.now()
    }
  });
  
  chrome.tabs.create({ 
    url: `https://codeforces.com/problemset/problem/${data.problem.contestId}/${data.problem.index}`
  });
  
  showStatus(
    `🚀 Battle Started!\n\nProblem: ${data.problem.contestId}${data.problem.index}\nOpponent: ${data.opponent}\n\nFirst correct submission wins!`,
    'success'
  );
}

// Handle submission update
function handleSubmissionUpdate(data) {
  showStatus(`📝 ${data.username} submitted!\nVerdict: ${data.status}`, 'warning');
}

// Handle match end
function handleMatchEnd(data) {
  chrome.storage.local.remove(['activeMatch']);
  
  const isWinner = data.winner === currentUser;
  const message = isWinner 
    ? `🎉 Victory!\n\nYou won the match!\nTime: ${data.solveTime}s` 
    : `💪 Good Fight!\n\n${data.winner} won\nTime: ${data.solveTime}s`;
  
  showStatus(message, isWinner ? 'success' : 'warning');
  
  setTimeout(() => {
    loadingSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    hideStatus();
  }, 5000);
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