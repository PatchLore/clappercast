const express = require('express');
const { WebSocketServer } = require('ws');
const https = require('https');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const cors = require('cors');
const os = require('os');
const certPath = path.join(__dirname, '../localhost+2.pem');
const keyPath = path.join(__dirname, '../localhost+2-key.pem');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

const server = https.createServer({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
}, app);
const wss = new WebSocketServer({ server });

const PING_INTERVAL = 15000;

// ── State ──────────────────────────────────────────────
const clients = new Map(); // id -> ws
let senderWs = null;
let receiverWs = null;
let sessionActive = false;

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(msg);
  });
}

// ── WebSocket signalling ───────────────────────────────
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

wss.on('close', () => clearInterval(heartbeat));

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.id = Math.random().toString(36).slice(2, 9);
  ws.on('pong', () => { ws.isAlive = true; });

  console.log(`[+] Client connected: ${ws.id}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
      return;
    }
    if (msg.type === 'register-sender') {
      senderWs = ws;
      ws.role = 'sender';
      sessionActive = true;
      console.log('[sender] registered');
      ws.send(JSON.stringify({ type: 'registered', role: 'sender' }));
      if (receiverWs?.readyState === 1) {
        console.log('[server] receiver already connected — notifying both');
        receiverWs.send(JSON.stringify({ type: 'sender-ready' }));
        ws.send(JSON.stringify({ type: 'receiver-connected' }));
      }
      return;
    }
    if (msg.type === 'register-receiver') {
      receiverWs = ws;
      ws.role = 'receiver';
      console.log('[receiver] registered');
      ws.send(JSON.stringify({ type: 'registered', role: 'receiver' }));
      if (senderWs?.readyState === 1) {
        console.log('[server] sender already connected — notifying both');
        ws.send(JSON.stringify({ type: 'sender-ready' }));
        senderWs.send(JSON.stringify({ type: 'receiver-connected' }));
      }
      return;
    }
    if (msg.type === 'offer' && receiverWs?.readyState === 1) {
      receiverWs.send(JSON.stringify(msg));
      return;
    }
    if (msg.type === 'answer' && senderWs?.readyState === 1) {
      senderWs.send(JSON.stringify(msg));
      return;
    }
    if (msg.type === 'ice-candidate') {
      if (ws.role === 'sender' && receiverWs?.readyState === 1) {
        receiverWs.send(JSON.stringify(msg));
      }
      if (ws.role === 'receiver' && senderWs?.readyState === 1) {
        senderWs.send(JSON.stringify(msg));
      }
      return;
    }
    if (msg.type === 'status') {
      broadcast({ type: 'status-update', ...msg }, ws);
      return;
    }
    console.log('[?] Unknown message type:', msg.type);
  });

  ws.on('close', () => {
    console.log('[disconnect]', ws.role, ws.id);
    if (ws === senderWs) {
      senderWs = null;
      sessionActive = false;
      if (receiverWs?.readyState === 1) {
        receiverWs.send(JSON.stringify({ type: 'sender-disconnected' }));
      }
    }
    if (ws === receiverWs) {
      receiverWs = null;
      if (senderWs?.readyState === 1) {
        senderWs.send(JSON.stringify({ type: 'receiver-disconnected' }));
      }
    }
  });
});

// ── REST endpoints ─────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    senderConnected: !!senderWs,
    receiverConnected: !!receiverWs,
    sessionActive,
  });
});

app.get('/landing', (req, res) => 
  res.sendFile(path.join(__dirname, '../public/landing.html'))
);
app.get('/setup', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/setup.html'))
);

app.get('/api/invite', (req, res) => {
  const ip = getLocalIP();
  const port = server.address()?.port || PORT;
  res.json({
    receiver: `https://${ip}:${port}/receiver`,
    landing: `https://${ip}:${port}/landing`,
    qrEndpoint: `https://${ip}:${port}/qr`
  });
});

app.get('/qr', async (req, res) => {
  const ip = getLocalIP();
  const port = server.address()?.port || PORT;
  const url = `https://${ip}:${port}/receiver`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ url, qr });
});

// ── Serve different pages ──────────────────────────────
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, '../public/sender.html'), 'utf8');
  html = html.replace(/__SERVER_IP__/g, getLocalIP());
  res.send(html);
});

app.get('/receiver', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, '../public/receiver.html'), 'utf8');
  html = html.replace(/__SERVER_IP__/g, getLocalIP());
  res.send(html);
});

// ── Start ──────────────────────────────────────────────
const PORT = process.env.PORT || 3747;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     ClapperCast Bridge  🎙️            ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  PC sender:   https://localhost:${PORT}  ║`);
  console.log(`║  Phone:       https://${ip}:${PORT}/receiver ║`);
  console.log('╚══════════════════════════════════════╝\n');
  console.log('Scan the QR code on the sender page to connect your phone.\n');
  initNgrok();
});

async function initNgrok() {
  if (!process.env.NGROK_AUTHTOKEN) return;
  try {
    const ngrok = require('@ngrok/ngrok');
    const url = await ngrok.connect({
      addr: PORT,
      authtoken: process.env.NGROK_AUTHTOKEN,
    });
    console.log(`  Tunnel:        ${url}/receiver`);
  } catch (e) {
    console.log('  ngrok failed:', e.message);
  }
}
