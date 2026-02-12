#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidecarServer = void 0;
const ws_1 = require("ws");
const router_1 = require("./router");
const DEFAULT_PORT = 8086;
const PING_INTERVAL = 30000;
/**
 * Neara Sidecar Server
 *
 * WebSocket server that acts as a hub for:
 * - The Neara web app (connects from browser)
 * - Applets (LSP, dim test, dim analyze, etc.)
 *
 * Routes messages between the web app and applets.
 */
class SidecarServer {
    constructor(options) {
        this.pingInterval = null;
        this.router = new router_1.MessageRouter();
        this.wss = new ws_1.WebSocketServer({ port: options.port });
        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
        // Set up ping interval for keep-alive
        this.pingInterval = setInterval(() => {
            this.pingClients();
        }, PING_INTERVAL);
        console.log(`Neara Sidecar server listening on ws://localhost:${options.port}`);
    }
    handleConnection(ws, req) {
        const clientIp = req.socket.remoteAddress;
        console.log(`New connection from ${clientIp}`);
        // Determine client type and optional tag from query params
        // Default to applet; webapp will be identified by its first message
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const clientType = url.searchParams.get('type') === 'webapp' ? 'webapp' : 'applet';
        const tag = url.searchParams.get('tag') || undefined;
        this.router.registerClient(ws, clientType, tag);
        ws.on('message', (data) => {
            this.handleMessage(ws, data);
        });
        ws.on('close', () => {
            this.router.removeClient(ws);
        });
        ws.on('error', (error) => {
            console.error('WebSocket client error:', error);
            this.router.removeClient(ws);
        });
    }
    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());
            this.router.routeMessage(ws, message);
        }
        catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
    pingClients() {
        this.wss.clients.forEach((ws) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        });
    }
    getStatus() {
        return this.router.getStatus();
    }
    close() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.wss.close();
    }
}
exports.SidecarServer = SidecarServer;
// Main entry point
function main() {
    const args = process.argv.slice(2);
    let port = DEFAULT_PORT;
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) {
            port = parseInt(args[i + 1], 10);
            i++;
        }
    }
    const server = new SidecarServer({ port });
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        server.close();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.log('\nShutting down...');
        server.close();
        process.exit(0);
    });
    // Log status periodically
    setInterval(() => {
        const status = server.getStatus();
        const webappTags = status.webapps.map(w => w.isDefault ? `${w.tag}*` : w.tag);
        console.log(`Status: webapps=[${webappTags.join(', ')}], applets=[${status.applets.join(', ')}]`);
    }, 60000);
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=server.js.map