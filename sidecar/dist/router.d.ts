import { WebSocket } from 'ws';
import { WebSocketMessage, AppletRegistration } from './types';
/**
 * Webapp tab info for status/listing
 */
export interface WebappInfo {
    tag: string;
    connectedAt: number;
    isDefault: boolean;
}
/**
 * Manages connected clients and routes messages between them
 */
export declare class MessageRouter {
    private clients;
    private webappClients;
    private webappsBySocket;
    private webappConnectedAt;
    private defaultWebappTag;
    private appletsByType;
    private nextClientId;
    private pendingRequests;
    private nextProxyId;
    private logStreamingClient;
    /**
     * Generate a short unique tag
     */
    private generateTag;
    /**
     * Generate a unique tag, suffixing with counter if base is taken
     */
    private generateUniqueTag;
    /**
     * Register a new client connection
     */
    registerClient(ws: WebSocket, type: 'webapp' | 'applet', tag?: string): void;
    /**
     * Handle applet registration message
     */
    registerApplet(ws: WebSocket, registration: AppletRegistration): void;
    /**
     * Fail pending requests that were targeting a specific tag
     */
    private failRequestsForTag;
    /**
     * Remove a client connection
     */
    removeClient(ws: WebSocket): void;
    /**
     * Route a message from a client
     */
    routeMessage(source: WebSocket, message: WebSocketMessage): void;
    /**
     * Handle tabs list request - send list of connected webapp tabs
     */
    private handleTabsRequest;
    /**
     * Route message from webapp to appropriate applet
     */
    private routeFromWebapp;
    /**
     * Route message from applet to webapp
     */
    private routeFromApplet;
    /**
     * Handle response from webapp to a request from an applet
     */
    private handleResponseFromWebapp;
    /**
     * Send a message to a specific client
     */
    private sendToClient;
    /**
     * Broadcast a message to all connected clients
     */
    broadcast(message: WebSocketMessage): void;
    /**
     * Get status information
     */
    getStatus(): {
        webapps: WebappInfo[];
        applets: string[];
    };
}
//# sourceMappingURL=router.d.ts.map