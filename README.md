# ClapperCast Bridge 🎙️

Stream OBS audio from your PC to your phone for Clapper Radio — zero latency, zero ToS violations.

## How it works

```
OBS Studio → VB-Audio Cable → ClapperCast PC Sender
                                      ↓ WebRTC (Wi-Fi)
                              ClapperCast Phone Receiver
                                      ↓ System audio-in
                              Clapper Radio (sees: wired mic)
```

## Quick start

### Clone the project
```bash
git clone https://github.com/PatchLore/clappercast.git
```

### 1. Install dependencies
```bash
npm install
```

### 2. Install VB-Audio Virtual Cable (free)
https://vb-audio.com/Cable/

Restart your PC after installing.

### 3. Configure OBS
- Settings → Audio → Monitoring Device → **VB-Audio Virtual Cable**
- For each audio source: right-click → Advanced Audio Properties → set to **Monitor and Output**

### 4. Start the server
```bash
npm start
```

### 5. Open the sender on your PC
http://localhost:3747

### 6. Connect your phone
- Scan the QR code shown on the sender page
- Your phone must be on the **same Wi-Fi** as your PC
- Tap "Receive audio" on your phone

### 7. Select audio source on PC
- Choose **CABLE Output (VB-Audio Virtual Cable)** from the dropdown
- Click **Start streaming to phone**

### 8. Go live on Clapper
- Open Clapper app → Radio → Start session
- Clapper picks up your PC audio as if it's a wired headset 🎙️

## Troubleshooting

**Phone can't reach PC**: Make sure both are on the same Wi-Fi. Some routers block device-to-device traffic — try a mobile hotspot from your PC instead.

**No audio on phone**: On iPhone, you must tap "Tap to receive audio" BEFORE the stream starts (iOS requires a user gesture to unlock audio playback).

**VB-Audio not showing**: Restart your browser after installing VB-Audio.

**High latency**: WebRTC on local Wi-Fi should be <50ms. If higher, plug your phone in via USB and use USB tethering.

## Architecture

| File | Role |
|------|------|
| `server/index.js` | Node.js WebSocket signalling server + static file server |
| `public/sender.html` | PC browser app — captures audio, sends via WebRTC |
| `public/receiver.html` | Phone browser app — receives WebRTC audio, plays to system |

## Next steps (post-MVP)

- [ ] USB audio mode (replaces Wi-Fi for zero-latency)
- [ ] Soundboard panel (play AudioForge stories with hotkeys)
- [ ] Multi-track mixing (mic + music + stories)
- [ ] HTTPS + ngrok support (for streaming outside local network)
- [ ] Native iOS app (removes need for browser, bypasses background audio limits)

---

Built by PatchLore · clappercast.io
