#!/usr/bin/env node
import { WebappInfo } from './router';
interface ServerOptions {
    port: number;
}
/**
 * Neara Sidecar Server
 *
 * WebSocket server that acts as a hub for:
 * - The Neara web app (connects from browser)
 * - Applets (LSP, dim test, dim analyze, etc.)
 *
 * Routes messages between the web app and applets.
 */
export declare class SidecarServer {
    private wss;
    private router;
    private pingInterval;
    constructor(options: ServerOptions);
    private handleConnection;
    private handleMessage;
    private pingClients;
    getStatus(): {
        webapps: WebappInfo[];
        applets: string[];
    };
    close(): void;
}
export {};
//# sourceMappingURL=server.d.ts.map