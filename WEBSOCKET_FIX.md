# WebSocket Connection Fix for Chrome Extension

## Problem

WebSockets were disconnecting when switching tabs or when the Chrome extension service worker became inactive.

## Root Cause

Chrome Manifest V3 service workers can become inactive after ~30 seconds of inactivity. This causes:

1. WebSocket connections to be terminated
2. Background scripts to stop running
3. Loss of real-time communication with the server

## Solutions Implemented

### 1. **Service Worker Keep-Alive Mechanism** (`background.js`)

- Added `keepAliveInterval` that runs every 20 seconds
- Calls `chrome.runtime.getPlatformInfo()` to keep service worker active
- Automatically checks WebSocket health and reconnects if needed

### 2. **Alarm-Based Keep-Alive** (`background.js` + `manifest.json`)

- Added `alarms` permission to manifest
- Created periodic alarm that triggers every 1 minute
- Provides redundant keep-alive mechanism
- Checks WebSocket health on each alarm

### 3. **Tab & Window Event Listeners** (`background.js`)

- Added `chrome.tabs.onActivated` listener for tab switches
- Added `chrome.windows.onFocusChanged` listener for window focus changes
- Both events trigger WebSocket health check and reconnection if needed

### 4. **Heartbeat/Ping-Pong System**

- **Client Side** (`background.js`):
  - Sends ping message to server every 30 seconds
  - Receives pong response to confirm connection is alive
- **Server Side** (`server.js`):
  - Handles ping messages and responds with pong
  - Uses native WebSocket ping/pong frames to detect broken connections
  - Terminates unresponsive connections after 30 seconds

### 5. **Robust Reconnection Logic** (`background.js`)

- Improved connection cleanup before reconnection attempts
- Prevents multiple simultaneous connection attempts
- 3-second delay between reconnection attempts
- Clears all intervals/timeouts properly on disconnect

### 6. **State Persistence**

- Active matches are stored in `chrome.storage.local`
- When user reconnects, server resends match information
- No data loss during reconnection

## Files Modified

### `client/background.js`

- Added keep-alive interval
- Added heartbeat ping system
- Improved WebSocket connection handling
- Added tab/window event listeners
- Added alarm listener
- Enhanced reconnection logic

### `client/manifest.json`

- Added `"alarms"` permission

### `server/server.js`

- Added ping/pong message handling
- Added native WebSocket heartbeat
- Added connection health monitoring

## How It Works

1. **Keep-Alive**: Service worker stays active through periodic API calls
2. **Heartbeat**: Client sends ping every 30s, server responds with pong
3. **Health Check**: Every 20s, checks if WebSocket is connected
4. **Auto-Reconnect**: If disconnected, automatically reconnects after 3s
5. **Event Triggers**: Tab switches and window focus trigger connection checks
6. **Alarms**: Backup mechanism runs every minute to ensure connection

## Testing

To verify the fix works:

1. Start the server: `cd server && node server.js`
2. Load the extension in Chrome
3. Login with your Codeforces username
4. Switch between tabs multiple times
5. Wait for 1-2 minutes
6. Check that WebSocket remains connected (verify in console logs)

## Benefits

✅ WebSocket stays connected when switching tabs
✅ Automatic reconnection if connection drops
✅ No loss of active match data
✅ Service worker remains active during active sessions
✅ Handles browser sleep/wake cycles
✅ Redundant keep-alive mechanisms for reliability
