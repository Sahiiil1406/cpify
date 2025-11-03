const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');

const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT });

// Data structures
const connectedUsers = new Map(); // username -> ws connection
const matchmakingQueue = []; // users waiting for random match
const activeMatches = new Map(); // matchId -> match data
const privateRooms = new Map(); // roomCode -> room data

// Problem pool (you can expand this)
const PROBLEM_POOL = [
  { contestId: 1000, index: 'A', rating: 800 },
  { contestId: 1100, index: 'A', rating: 800 },
  { contestId: 1200, index: 'B', rating: 1000 },
  { contestId: 1300, index: 'B', rating: 1000 },
  { contestId: 1400, index: 'C', rating: 1200 }
];

console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleClientMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove user from all data structures
    for (const [username, connection] of connectedUsers.entries()) {
      if (connection === ws) {
        connectedUsers.delete(username);
        removeFromQueue(username);
        console.log(`User ${username} disconnected`);
        break;
      }
    }
  });
});

function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'register':
      handleRegister(ws, data);
      break;
    case 'find_match':
      handleFindMatch(ws, data);
      break;
    case 'create_room':
      handleCreateRoom(ws, data);
      break;
    case 'join_room':
      handleJoinRoom(ws, data);
      break;
    case 'submission':
      handleSubmission(ws, data);
      break;
  }
}

function handleRegister(ws, data) {
  const { username } = data;
  connectedUsers.set(username, ws);
  console.log(`User registered: ${username}`);
  
  // Check if user has a pending match that started while they were disconnected
  for (const [matchId, match] of activeMatches.entries()) {
    if (!match.ended && (match.player1 === username || match.player2 === username)) {
      // Resend match start to newly connected user
      const opponent = match.player1 === username ? match.player2 : match.player1;
      sendMessage(username, {
        type: 'match_start',
        matchId: match.matchId,
        problem: match.problem,
        opponent: opponent
      });
      console.log(`Resent match start to reconnected user: ${username}`);
      break;
    }
  }
}

function handleFindMatch(ws, data) {
  const { username } = data;
  
  // Check if already in queue
  if (matchmakingQueue.includes(username)) {
    return;
  }
  
  matchmakingQueue.push(username);
  console.log(`User ${username} joined matchmaking queue`);
  
  // Try to make a match
  if (matchmakingQueue.length >= 2) {
    const player1 = matchmakingQueue.shift();
    const player2 = matchmakingQueue.shift();
    createMatch(player1, player2);
  }
}

function handleCreateRoom(ws, data) {
  const { username } = data;
  const roomCode = generateRoomCode();
  
  privateRooms.set(roomCode, {
    host: username,
    guest: null,
    createdAt: Date.now()
  });
  
  sendMessage(username, {
    type: 'room_created',
    roomCode: roomCode
  });
  
  console.log(`Room ${roomCode} created by ${username}`);
}

function handleJoinRoom(ws, data) {
  const { username, roomCode } = data;
  
  const room = privateRooms.get(roomCode);
  
  if (!room) {
    sendMessage(username, {
      type: 'error',
      message: 'Room not found'
    });
    return;
  }
  
  if (room.host === username) {
    sendMessage(username, {
      type: 'error',
      message: 'You cannot join your own room'
    });
    return;
  }
  
  if (room.guest) {
    sendMessage(username, {
      type: 'error',
      message: 'Room is full'
    });
    return;
  }
  
  room.guest = username;
  
  sendMessage(username, {
    type: 'room_joined',
    roomCode: roomCode
  });
  
  // Start match
  createMatch(room.host, room.guest);
  privateRooms.delete(roomCode);
}

function createMatch(player1, player2) {
  const matchId = generateMatchId();
  const problem = selectRandomProblem();
  
  const match = {
    matchId,
    player1,
    player2,
    problem,
    startTime: Date.now(),
    submissions: {},
    ended: false
  };
  
  activeMatches.set(matchId, match);
  
  // Notify both players
  sendMessage(player1, {
    type: 'match_found',
    opponent: player2
  });
  
  sendMessage(player2, {
    type: 'match_found',
    opponent: player1
  });
  
  // Notify both players immediately
  setTimeout(() => {
    const player1Connected = connectedUsers.has(player1);
    const player2Connected = connectedUsers.has(player2);
    
    if (player1Connected) {
      sendMessage(player1, {
        type: 'match_start',
        matchId,
        problem,
        opponent: player2
      });
    }
    
    if (player2Connected) {
      sendMessage(player2, {
        type: 'match_start',
        matchId,
        problem,
        opponent: player1
      });
    }
    
    // Start monitoring submissions
    if (player1Connected || player2Connected) {
      monitorMatch(matchId);
    }
  }, 1000);
  
  console.log(`Match created: ${player1} vs ${player2}`);
}

async function monitorMatch(matchId) {
  const match = activeMatches.get(matchId);
  if (!match || match.ended) return;
  
  const { player1, player2, problem, startTime } = match;
  
  try {
    // Check submissions for both players
    const submissions1 = await getRecentSubmissions(player1, problem);
    const submissions2 = await getRecentSubmissions(player2, problem);
    
    // Check if any player solved
    const solved1 = submissions1.find(s => s.verdict === 'OK');
    const solved2 = submissions2.find(s => s.verdict === 'OK');
    
    if (solved1 || solved2) {
      let winner, solveTime;
      
      if (solved1 && solved2) {
        // Both solved, earliest wins
        winner = solved1.creationTimeSeconds < solved2.creationTimeSeconds ? player1 : player2;
        solveTime = Math.min(solved1.creationTimeSeconds, solved2.creationTimeSeconds) - Math.floor(startTime / 1000);
      } else if (solved1) {
        winner = player1;
        solveTime = solved1.creationTimeSeconds - Math.floor(startTime / 1000);
      } else {
        winner = player2;
        solveTime = solved2.creationTimeSeconds - Math.floor(startTime / 1000);
      }
      
      endMatch(matchId, winner, solveTime);
      return;
    }
    
    // Notify about submissions
    if (submissions1.length > 0) {
      const latest = submissions1[0];
      if (!match.submissions[player1] || match.submissions[player1] < latest.id) {
        match.submissions[player1] = latest.id;
        sendMessage(player2, {
          type: 'submission_update',
          username: player1,
          status: latest.verdict
        });
      }
    }
    
    if (submissions2.length > 0) {
      const latest = submissions2[0];
      if (!match.submissions[player2] || match.submissions[player2] < latest.id) {
        match.submissions[player2] = latest.id;
        sendMessage(player1, {
          type: 'submission_update',
          username: player2,
          status: latest.verdict
        });
      }
    }
    
    // Continue monitoring
    setTimeout(() => monitorMatch(matchId), 5000);
  } catch (error) {
    console.error('Error monitoring match:', error);
    setTimeout(() => monitorMatch(matchId), 5000);
  }
}

async function getRecentSubmissions(username, problem) {
  try {
    const response = await axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=10`);
    
    if (response.data.status !== 'OK') return [];
    
    const submissions = response.data.result.filter(s => 
      s.problem.contestId === problem.contestId && 
      s.problem.index === problem.index
    );
    
    return submissions;
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
}

function endMatch(matchId, winner, solveTime) {
  const match = activeMatches.get(matchId);
  if (!match || match.ended) return;
  
  match.ended = true;
  
  sendMessage(match.player1, {
    type: 'match_end',
    winner,
    solveTime,
    matchId
  });
  
  sendMessage(match.player2, {
    type: 'match_end',
    winner,
    solveTime,
    matchId
  });
  
  console.log(`Match ${matchId} ended. Winner: ${winner}`);
  
  // Clean up after 1 minute
  setTimeout(() => activeMatches.delete(matchId), 60000);
}

function sendMessage(username, message) {
  const ws = connectedUsers.get(username);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function removeFromQueue(username) {
  const index = matchmakingQueue.indexOf(username);
  if (index > -1) {
    matchmakingQueue.splice(index, 1);
  }
}

function selectRandomProblem() {
  return PROBLEM_POOL[Math.floor(Math.random() * PROBLEM_POOL.length)];
}

function generateMatchId() {
  return 'match_' + crypto.randomBytes(8).toString('hex');
}

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Clean up old rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomCode, room] of privateRooms.entries()) {
    if (now - room.createdAt > 300000) { // 5 minutes
      privateRooms.delete(roomCode);
      console.log(`Room ${roomCode} expired`);
    }
  }
}, 300000);