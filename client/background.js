// Background service worker with persistent WebSocket connection

const WS_SERVER = "ws://localhost:3000";
let ws = null;
let currentUser = null;
let reconnectInterval = null;
let keepAliveInterval = null;
let heartbeatInterval = null;

console.log("CF 1v1 Arena background service worker started");

// Keep service worker alive
function keepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  keepAliveInterval = setInterval(() => {
    // Send a message to keep the service worker active
    chrome.runtime.getPlatformInfo(() => {
      // This action keeps the service worker alive
    });

    // Check WebSocket health
    if (currentUser && (!ws || ws.readyState !== WebSocket.OPEN)) {
      console.log("WebSocket disconnected, attempting reconnection...");
      connectWebSocket();
    }
  }, 20000); // Check every 20 seconds
}

// Start keep-alive on initialization
keepAlive();

// Initialize on startup
chrome.storage.local.get(["cfUsername"], (result) => {
  if (result.cfUsername) {
    currentUser = result.cfUsername;
    connectWebSocket();
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  if (request.type === "connect_ws") {
    currentUser = request.username;
    connectWebSocket();
    sendResponse({ success: true });
  } else if (request.type === "disconnect_ws") {
    disconnectWebSocket();
    currentUser = null;
    sendResponse({ success: true });
  } else if (request.type === "send_ws") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(request.data));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "WebSocket not connected" });
    }
  } else if (request.type === "ws_status") {
    sendResponse({
      connected: ws && ws.readyState === WebSocket.OPEN,
      username: currentUser,
    });
  } else if (request.type === "open_popup") {
    chrome.action.openPopup();
    sendResponse({ success: true });
  }

  return true; // Keep channel open for async response
});

// WebSocket Connection
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("WebSocket already connected");
    return;
  }

  // Clean up existing connection attempts
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.onopen = null;
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }

  console.log("Connecting to WebSocket server...");
  ws = new WebSocket(WS_SERVER);

  ws.onopen = () => {
    console.log("WebSocket connected");
    clearInterval(reconnectInterval);
    reconnectInterval = null;

    // Register user
    ws.send(
      JSON.stringify({
        type: "register",
        username: currentUser,
      })
    );

    // Start heartbeat to keep connection alive
    startHeartbeat();

    // Notify popup if open
    chrome.runtime
      .sendMessage({
        type: "ws_connected",
      })
      .catch(() => {});
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("WebSocket message received:", data);

    // Handle pong responses
    if (data.type === "pong") {
      console.log("Received pong from server");
      return;
    }

    handleServerMessage(data);
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log("WebSocket disconnected", event.code, event.reason);
    ws = null;

    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Reconnect after 3 seconds if user is logged in
    if (currentUser && !reconnectInterval) {
      reconnectInterval = setTimeout(() => {
        console.log("Attempting to reconnect...");
        reconnectInterval = null;
        connectWebSocket();
      }, 3000);
    }
  };
}

// Send periodic heartbeat to keep connection alive
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
        console.log("Sent ping to server");
      } catch (error) {
        console.error("Error sending heartbeat:", error);
      }
    }
  }, 30000); // Send heartbeat every 30 seconds
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  clearInterval(reconnectInterval);
  reconnectInterval = null;

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Handle messages from server
function handleServerMessage(data) {
  console.log("Handling server message:", data.type);

  switch (data.type) {
    case "match_found":
      handleMatchFound(data);
      break;
    case "room_created":
      notifyPopup("room_created", data);
      break;
    case "room_joined":
      notifyPopup("room_joined", data);
      break;
    case "match_start":
      handleMatchStart(data);
      break;
    case "submission_update":
      notifyPopup("submission_update", data);
      showNotification(
        "Submission Update",
        `${data.username} submitted! Status: ${data.status}`
      );
      break;
    case "match_end":
      handleMatchEnd(data);
      break;
    case "error":
      notifyPopup("error", data);
      break;
  }
}

function handleMatchFound(data) {
  console, log("Match found:", data);
  notifyPopup("match_found", data);
  showNotification("Match Found!", `Opponent: ${data.opponent}`);
}

function handleMatchStart(data) {
  console.log("Match starting:", data);

  // Store match data
  chrome.storage.local.set(
    {
      activeMatch: {
        matchId: data.matchId,
        problem: data.problem,
        opponent: data.opponent,
        startTime: Date.now(),
      },
    },
    () => {
      console.log("Match data stored");

      // Open problem in new tab
      chrome.tabs.create(
        {
          url: `https://codeforces.com/problemset/problem/${data.problem.contestId}/${data.problem.index}`,
        },
        (tab) => {
          console.log("Problem tab opened:", tab.id);
        }
      );

      // Notify popup
      notifyPopup("match_start", data);

      // Show notification
      showNotification(
        "Battle Started!",
        `Problem: ${data.problem.contestId}${data.problem.index} vs ${data.opponent}`
      );
    }
  );
}

function handleMatchEnd(data) {
  console.log("Match ended:", data);
  console.log("Current user:", currentUser);
  console.log("Winner:", data.winner);
  console.log("Player1:", data.player1);
  console.log("Player2:", data.player2);

  // Get match data
  chrome.storage.local.get(["activeMatch"], (result) => {
    const match = result.activeMatch || {};

    // Remove active match
    chrome.storage.local.remove(["activeMatch"]);

    const isWinner = data.winner === currentUser;
    console.log("Is current user the winner?", isWinner);

    // Show notification
    showNotification(
      isWinner ? "Victory! 🎉" : "Match Ended",
      isWinner ? "You won the match!" : `${data.winner} won`
    );

    // Create results URL
    const resultsUrl =
      chrome.runtime.getURL("results.html") +
      `?winner=${encodeURIComponent(data.winner)}` +
      `&player1=${encodeURIComponent(data.player1)}` +
      `&player2=${encodeURIComponent(data.player2)}` +
      `&solveTime=${data.solveTime || 0}` +
      `&problemId=${
        match.problem ? match.problem.contestId + match.problem.index : "N/A"
      }` +
      `&contestId=${match.problem ? match.problem.contestId : ""}` +
      `&problemIndex=${match.problem ? match.problem.index : ""}` +
      `&currentUser=${encodeURIComponent(currentUser)}`;

    console.log("Opening results page:", resultsUrl);
    console.log("URL contains currentUser:", currentUser);

    // Open results page
    chrome.tabs.create({ url: resultsUrl }, (tab) => {
      console.log("Results tab created:", tab.id);
    });

    // Notify popup
    notifyPopup("match_end", data);

    // Send to content scripts
    chrome.tabs.query({ url: "https://codeforces.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            type: "match_end",
            won: isWinner,
            message: isWinner ? "You won!" : `${data.winner} won`,
          })
          .catch(() => {});
      });
    });
  });
}

function notifyPopup(type, data) {
  chrome.runtime
    .sendMessage({
      type: "server_message",
      messageType: type,
      data: data,
    })
    .catch(() => {
      // Popup might be closed, that's okay
      console.log("Could not notify popup (might be closed)");
    });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: title,
    message: message,
    priority: 2,
  });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Extension installed");
    chrome.tabs.create({ url: "popup.html" });
  }

  // Set up periodic alarm to keep service worker alive
  chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    console.log("Keep-alive alarm triggered");

    // Check WebSocket health
    if (currentUser && (!ws || ws.readyState !== WebSocket.OPEN)) {
      console.log("WebSocket disconnected during alarm check, reconnecting...");
      connectWebSocket();
    }
  }
});

// Monitor tab changes to detect when user switches tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log("Tab activated:", activeInfo.tabId);
  keepAlive(); // Refresh keep-alive

  // Check WebSocket connection
  if (currentUser && (!ws || ws.readyState !== WebSocket.OPEN)) {
    console.log("Tab switch detected, checking WebSocket...");
    connectWebSocket();
  }
});

// Monitor window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    console.log("Window focused:", windowId);
    keepAlive(); // Refresh keep-alive

    // Check WebSocket connection
    if (currentUser && (!ws || ws.readyState !== WebSocket.OPEN)) {
      console.log("Window focus changed, checking WebSocket...");
      connectWebSocket();
    }
  }
});
