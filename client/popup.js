// Configuration
const WS_SERVER = 'ws://localhost:3000'; // Change to your backend server

let ws = null;
let currentUser = null;

// DOM Elements
const authSection = document.getElementById('authSection');
const gameSection = document.getElementById('gameSection');
const loadingSection = document.getElementById('loadingSection');
const usernameInput = document.getElementById('usernameInput');
const verifyBtn = document.getElementById('verifyBtn');
const displayUsername = document.getElementById('displayUsername');
const logoutBtn = document.getElementById('logoutBtn');
const randomMatchBtn = document.getElementById('randomMatchBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const statusDiv = document.getElementById('statusDiv');
const errorDiv = document.getElementById('errorDiv');

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
  
  verifyBtn.textContent = 'Verifying...';
  verifyBtn.disabled = true;
  
  try {
    // Verify user exists on Codeforces
    const response = await fetch(`https://codeforces.com/api/user.info?handles=${username}`);
    const data = await response.json();
    
    if (data.status === 'OK') {
      await chrome.storage.local.set({ cfUsername: username });
      currentUser = username;
      showGameSection();
      connectWebSocket();
    } else {
      showError('User not found on Codeforces');
    }
  } catch (error) {
    showError('Failed to verify user. Please try again.');
  } finally {
    verifyBtn.textContent = 'Verify & Start';
    verifyBtn.disabled = false;
  }
}

// Show game section
function showGameSection() {
  authSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  displayUsername.textContent = currentUser;
  connectWebSocket();
}

// Logout
async function logout() {
  await chrome.storage.local.remove(['cfUsername']);
  if (ws) {
    ws.close();
  }
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
  
  ws.onerror = (error) => {
    showError('Connection error. Make sure the server is running.');
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('Disconnected from server');
    setTimeout(connectWebSocket, 3000); // Reconnect after 3s
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
      break;
  }
}

// Find random match
function findRandomMatch() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showError('Not connected to server');
    return;
  }
  
  loadingSection.classList.remove('hidden');
  gameSection.classList.add('hidden');
  
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
  
  showStatus('Creating room...');
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
  
  showStatus('Joining room...');
}

// Handle match found
function handleMatchFound(data) {
  loadingSection.classList.add('hidden');
  showStatus(`Match found! Opponent: ${data.opponent}`);
}

// Handle room created
function handleRoomCreated(data) {
  showStatus(`Room created! Code: ${data.roomCode}\nShare this code with your friend.`);
  roomCodeInput.value = data.roomCode;
}

// Handle room joined
function handleRoomJoined(data) {
  showStatus(`Joined room! Waiting for match to start...`);
}

// Handle match start
function handleMatchStart(data) {
  // Store match data
  chrome.storage.local.set({ 
    activeMatch: {
      matchId: data.matchId,
      problem: data.problem,
      opponent: data.opponent,
      startTime: Date.now()
    }
  });
  
  // Open problem in new tab
  chrome.tabs.create({ 
    url: `https://codeforces.com/problemset/problem/${data.problem.contestId}/${data.problem.index}`
  });
  
  showStatus(`Match started! Problem: ${data.problem.contestId}${data.problem.index}\nFirst to solve wins!`);
}

// Handle submission update
function handleSubmissionUpdate(data) {
  showStatus(`${data.username} submitted! Status: ${data.status}`);
}

// Handle match end
function handleMatchEnd(data) {
  chrome.storage.local.remove(['activeMatch']);
  
  const winner = data.winner === currentUser ? 'You won! 🎉' : `${data.winner} won!`;
  showStatus(`Match ended!\n${winner}\nTime: ${data.solveTime}s`);
  
  // Show game section again
  setTimeout(() => {
    loadingSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
  }, 3000);
}

// Utility functions
function showStatus(message) {
  statusDiv.textContent = message;
  statusDiv.classList.remove('hidden');
}

function hideStatus() {
  statusDiv.classList.add('hidden');
}

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => hideError(), 5000);
}

function hideError() {
  errorDiv.classList.add('hidden');
}