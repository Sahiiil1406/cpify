# Codeforces 1v1 Arena - Chrome Extension

A Chrome extension for real-time 1v1 competitive programming battles on Codeforces!

## Features

- ⚔️ **Random Matchmaking** - Get matched with random opponents
- 🎯 **Private Rooms** - Create rooms and invite friends
- 📊 **Real-time Tracking** - Live submission monitoring
- 🏆 **Win Detection** - Automatic winner detection based on first accepted submission
- 🎨 **Beautiful UI** - Modern, animated interface

## Project Structure

```
cf-1v1-arena/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── content.js            # Content script for CF pages
├── background.js         # Background service worker
├── server.js             # WebSocket backend server
├── package.json          # Node.js dependencies
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Setup Instructions

### 1. Backend Server Setup

First, set up the Node.js backend server:

```bash
# Create project directory
mkdir cf-1v1-arena
cd cf-1v1-arena

# Initialize npm
npm init -y

# Install dependencies
npm install ws axios

# Save the server.js file
# Then start the server
node server.js
```

The server will run on `ws://localhost:3000`

### 2. Chrome Extension Setup

1. **Create Extension Files**
   - Create a folder for the extension
   - Add all the files: manifest.json, popup.html, popup.js, content.js, background.js

2. **Create Icons**
   - Create an `icons` folder
   - Add 16x16, 48x48, and 128x128 pixel PNG icons
   - Or use placeholder icons for testing

3. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select your extension folder

### 3. Usage

1. **First Time Setup**
   - Click the extension icon
   - Enter your Codeforces username
   - Click "Verify & Start"

2. **Find a Match**
   - Click "Random Match" to find an opponent
   - Or create a private room and share the code
   - Or join a friend's room using their code

3. **Battle!**
   - When matched, a problem opens automatically
   - Solve the problem on Codeforces
   - First to submit correct solution wins!

## How It Works

### Architecture

1. **Chrome Extension (Frontend)**
   - Popup UI for matchmaking
   - Content script for tracking submissions
   - Background worker for notifications

2. **WebSocket Server (Backend)**
   - Handles matchmaking queue
   - Creates and manages matches
   - Monitors Codeforces API for submissions
   - Determines winners

3. **Codeforces API**
   - Verifies usernames
   - Fetches submission status
   - Used for real-time tracking

### Match Flow

1. User enters matchmaking queue
2. Server pairs two players
3. Server selects random problem
4. Both players receive problem link
5. Server monitors submissions via CF API
6. First accepted submission wins
7. Both players notified of result

## Configuration

### Change Server URL

In `popup.js`, update the WebSocket URL:
```javascript
const WS_SERVER = 'ws://your-server-url:3000';
```

### Add More Problems

In `server.js`, expand the problem pool:
```javascript
const PROBLEM_POOL = [
  { contestId: 1000, index: 'A', rating: 800 },
  { contestId: 1100, index: 'A', rating: 800 },
  // Add more problems...
];
```

## Development Tips

### Testing Locally

1. Start the server: `node server.js`
2. Load extension in Chrome
3. Open extension popup
4. Use two different Chrome profiles to test matchmaking

### Debugging

- Check extension logs: `chrome://extensions/` → "Inspect views: service worker"
- Check server logs: View terminal where server is running
- Check content script: Open DevTools on Codeforces page

## Future Enhancements

- [ ] Rating-based matchmaking
- [ ] Leaderboard system
- [ ] Match history
- [ ] Time limits per match
- [ ] Multiple problems per match
- [ ] Spectator mode
- [ ] Tournament mode
- [ ] Discord integration
- [ ] ELO rating system

## Deployment

### Deploy Backend

You can deploy the backend to:
- **Heroku**: Free tier supports WebSocket
- **Railway**: Easy deployment
- **DigitalOcean**: Full control
- **AWS EC2**: Scalable solution

Update the `WS_SERVER` URL in popup.js after deployment.

## Troubleshooting

**Extension not connecting?**
- Make sure server is running
- Check WebSocket URL is correct
- Verify firewall allows WebSocket connections

**Match not starting?**
- Check both users are verified
- Ensure Codeforces API is accessible
- Check server logs for errors

**Winner not detected?**
- Codeforces API has rate limits
- Solution must be "OK" verdict
- Both players must be online

## License

MIT License - Feel free to modify and use!

## Contributing

Pull requests welcome! Some ideas:
- Better problem selection algorithm
- User statistics and rankings
- Mobile app version
- More game modes

## Credits

Built for competitive programmers who love the thrill of real-time battles! 🚀