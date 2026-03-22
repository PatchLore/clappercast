#!/usr/bin/env node
const os = require('os');
const fs = require('fs');
const net = require('net');

console.log('\n ClapperCast Bridge — Setup Check\n');

const nodeVersion = process.versions.node;
const [major] = nodeVersion.split('.').map(Number);
const nodeOk = major >= 16;
console.log(nodeOk ? '  Node.js       ' : '  Node.js       ', nodeVersion, nodeOk ? '(ok)' : '(need v16+)');

const depsOk = fs.existsSync('./node_modules/express') &&
               fs.existsSync('./node_modules/ws') &&
               fs.existsSync('./node_modules/qrcode');
console.log(depsOk ? '  Dependencies  installed' : '  Dependencies  MISSING — run npm install');

const ifaces = os.networkInterfaces();
let localIP = null;
for (const name of Object.keys(ifaces)) {
  for (const iface of ifaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIP = iface.address;
    }
  }
}
console.log(localIP ? '  Local IP      ' : '  Local IP      ', localIP || 'NOT FOUND — check Wi-Fi connection');

const tester = net.createServer();
tester.once('error', () => {
  console.log('  Port 3747     IN USE — stop the other process or set PORT=xxxx');
  tester.close();
  printSummary(nodeOk, depsOk, !!localIP, false);
});
tester.once('listening', () => {
  console.log('  Port 3747     available');
  tester.close();
  printSummary(nodeOk, depsOk, !!localIP, true);
});
tester.listen(3747);

function printSummary(node, deps, ip, port) {
  const allOk = node && deps && ip && port;
  console.log('\n' + (allOk
    ? ' All checks passed. Run: npm start\n'
    : ' Fix the issues above then run: npm start\n'));
  process.exit(allOk ? 0 : 1);
}
