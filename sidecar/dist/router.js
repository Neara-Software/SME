"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRouter = void 0;
const ws_1 = require("ws");
const types_1 = require("./types");
/**
 * Manages connected clients and routes messages between them
 */
class MessageRouter {
    constructor() {
        this.clients = new Map();
        this.webappClients = new Map();
        this.webappsBySocket = new Map();
        this.webappConnectedAt = new Map();
        this.defaultWebappTag = null;
        this.appletsByType = new Map();
        this.nextClientId = 1;
        // Track pending requests for correlation
        // Maps proxy request ID to {source client, original ID, target tag}
        this.pendingRequests = new Map();
        this.nextProxyId = 1;
        // Track client subscribed to console log streaming
        this.logStreamingClient = null;
    }
    /**
     * Generate a short unique tag
     */
    generateTag() {
        const timestamp = Date.now().toString(36);
        return `tab-${timestamp.slice(-4)}`;
    }
    /**
     * Generate a unique tag, suffixing with counter if base is taken
     */
    generateUniqueTag(base) {
        if (!this.webappClients.has(base)) {
            return base;
        }
        let counter = 1;
        while (this.webappClients.has(`${base}-${counter}`)) {
            counter++;
        }
        return `${base}-${counter}`;
    }
    /**
     * Register a new client connection
     */
    registerClient(ws, type, tag) {
        const clientId = `client-${this.nextClientId++}`;
        if (type === 'webapp') {
            // Generate or make tag unique
            const effectiveTag = tag
                ? this.generateUniqueTag(tag)
                : this.generateUniqueTag(this.generateTag());
            const client = {
                id: clientId,
                type,
                tag: effectiveTag,
            };
            this.clients.set(ws, client);
            // Track webapp by tag
            this.webappClients.set(effectiveTag, ws);
            this.webappsBySocket.set(ws, effectiveTag);
            this.webappConnectedAt.set(effectiveTag, Date.now());
            // Set as default if first webapp
            if (this.defaultWebappTag === null) {
                this.defaultWebappTag = effectiveTag;
            }
            console.log(`Webapp connected: ${clientId} (tag: ${effectiveTag}${this.defaultWebappTag === effectiveTag ? ', default' : ''})`);
        }
        else {
            const client = {
                id: clientId,
                type,
            };
            this.clients.set(ws, client);
            console.log(`Applet connected: ${clientId}`);
        }
    }
    /**
     * Handle applet registration message
     */
    registerApplet(ws, registration) {
        const client = this.clients.get(ws);
        if (!client) {
            console.error('Cannot register applet: client not found');
            return;
        }
        client.registration = registration;
        // Register this applet for each message type it handles
        for (const msgType of registration.handles) {
            if (this.appletsByType.has(msgType)) {
                console.log(`Warning: replacing existing handler for message type: ${msgType}`);
            }
            this.appletsByType.set(msgType, ws);
        }
        console.log(`Applet "${registration.name}" registered for types: ${registration.handles.join(', ')}`);
    }
    /**
     * Fail pending requests that were targeting a specific tag
     */
    failRequestsForTag(tag) {
        for (const [proxyId, pending] of this.pendingRequests.entries()) {
            if (pending.targetTag === tag) {
                // Send error response back to source
                const errorResponse = {
                    id: pending.originalId,
                    response: {
                        type: 'error',
                        payload: {
                            code: 'TAB_DISCONNECTED',
                            message: `Target tab '${tag}' disconnected`,
                        },
                    },
                };
                this.sendToClient(pending.source, errorResponse);
                this.pendingRequests.delete(proxyId);
            }
        }
    }
    /**
     * Remove a client connection
     */
    removeClient(ws) {
        const client = this.clients.get(ws);
        if (!client)
            return;
        if (client.type === 'webapp') {
            const tag = this.webappsBySocket.get(ws);
            if (tag) {
                // Fail pending requests targeting this tab
                this.failRequestsForTag(tag);
                // Clean up maps
                this.webappClients.delete(tag);
                this.webappsBySocket.delete(ws);
                this.webappConnectedAt.delete(tag);
                // Update default if this was the default
                if (this.defaultWebappTag === tag) {
                    // Pick the next oldest connected tab as default
                    let oldestTag = null;
                    let oldestTime = Infinity;
                    for (const [t, time] of this.webappConnectedAt.entries()) {
                        if (time < oldestTime) {
                            oldestTime = time;
                            oldestTag = t;
                        }
                    }
                    this.defaultWebappTag = oldestTag;
                    if (oldestTag) {
                        console.log(`Default webapp changed to: ${oldestTag}`);
                    }
                }
            }
        }
        // Clean up log streaming if this client was streaming
        if (this.logStreamingClient === ws) {
            this.logStreamingClient = null;
            console.log('Log streaming client disconnected');
        }
        // Remove applet type registrations
        if (client.registration) {
            for (const msgType of client.registration.handles) {
                if (this.appletsByType.get(msgType) === ws) {
                    this.appletsByType.delete(msgType);
                }
            }
        }
        this.clients.delete(ws);
        console.log(`Client disconnected: ${client.id}${client.tag ? ` (tag: ${client.tag})` : ''}`);
    }
    /**
     * Route a message from a client
     */
    routeMessage(source, message) {
        const startTime = performance.now();
        const sourceClient = this.clients.get(source);
        if (!sourceClient) {
            console.error('Message from unknown client');
            return;
        }
        const msgType = message.request?.type || message.type || 'unknown';
        console.log(`[timing] router: received ${msgType} from ${sourceClient.type}`);
        // Handle ping - respond with pong
        if ((0, types_1.isPingMessage)(message)) {
            this.sendToClient(source, { type: 'pong' });
            return;
        }
        // Handle registration messages
        if ((0, types_1.isRegisterMessage)(message)) {
            this.registerApplet(source, {
                name: message.payload.name,
                handles: message.payload.handles,
            });
            return;
        }
        // Handle tabs list request
        if ((0, types_1.isTabsRequestMessage)(message)) {
            this.handleTabsRequest(source);
            return;
        }
        // Route based on message type and source
        if (sourceClient.type === 'webapp') {
            this.routeFromWebapp(source, message);
        }
        else {
            this.routeFromApplet(source, message);
        }
    }
    /**
     * Handle tabs list request - send list of connected webapp tabs
     */
    handleTabsRequest(source) {
        const tabs = [];
        for (const [tag, _ws] of this.webappClients.entries()) {
            tabs.push({
                tag,
                connectedAt: this.webappConnectedAt.get(tag) || 0,
                isDefault: tag === this.defaultWebappTag,
            });
        }
        // Sort by connection time (oldest first)
        tabs.sort((a, b) => a.connectedAt - b.connectedAt);
        const response = {
            type: 'tabs_list',
            payload: {
                tabs,
                count: tabs.length,
                defaultTag: this.defaultWebappTag,
            },
        };
        this.sendToClient(source, response);
    }
    /**
     * Route message from webapp to appropriate applet
     */
    routeFromWebapp(source, message) {
        let msgType;
        if ((0, types_1.isOneWayMessage)(message)) {
            msgType = message.type;
        }
        else if ((0, types_1.isRequestMessage)(message)) {
            msgType = message.request.type;
        }
        else if ((0, types_1.isResponseMessage)(message)) {
            // This is a response to a request from an applet
            this.handleResponseFromWebapp(message);
            return;
        }
        if (!msgType) {
            console.error('Cannot determine message type');
            return;
        }
        // Special case: console_log_entries are streamed to the subscribed client
        if (msgType === 'console_log_entries') {
            if (this.logStreamingClient) {
                this.sendToClient(this.logStreamingClient, message);
            }
            else {
                console.log('Received console_log_entries but no client is streaming');
            }
            return;
        }
        const targetApplet = this.appletsByType.get(msgType);
        if (!targetApplet) {
            console.log(`No applet registered for message type: ${msgType}`);
            return;
        }
        this.sendToClient(targetApplet, message);
    }
    /**
     * Route message from applet to webapp
     */
    routeFromApplet(source, message) {
        // Extract target from routing metadata if present
        const routing = message.routing;
        const targetTag = routing?.target || this.defaultWebappTag;
        if (!targetTag) {
            console.log('No webapp connected, cannot route message from applet');
            if ((0, types_1.isRequestMessage)(message)) {
                // Send error response back
                const errorResponse = {
                    id: message.id,
                    response: {
                        type: 'error',
                        payload: {
                            code: 'NO_WEBAPP',
                            message: 'No webapp connected',
                        },
                    },
                };
                this.sendToClient(source, errorResponse);
            }
            return;
        }
        const targetWs = this.webappClients.get(targetTag);
        if (!targetWs) {
            console.log(`Target tab '${targetTag}' not found`);
            if ((0, types_1.isRequestMessage)(message)) {
                // Send error response with available tabs
                const availableTabs = Array.from(this.webappClients.keys());
                const errorResponse = {
                    id: message.id,
                    response: {
                        type: 'error',
                        payload: {
                            code: 'TAB_NOT_FOUND',
                            message: `Tab '${targetTag}' not found`,
                            availableTabs,
                        },
                    },
                };
                this.sendToClient(source, errorResponse);
            }
            return;
        }
        if ((0, types_1.isRequestMessage)(message)) {
            // Track console_log streaming client
            if (message.request.type === 'console_log') {
                const payload = message.request.payload;
                if (payload?.subtype === 'start') {
                    this.logStreamingClient = source;
                    console.log('Registered client for console log streaming');
                }
                else if (payload?.subtype === 'stop') {
                    this.logStreamingClient = null;
                    console.log('Unregistered client from console log streaming');
                }
            }
            // Proxy the request with a new ID and track for response routing
            const proxyId = this.nextProxyId++;
            this.pendingRequests.set(proxyId, {
                source,
                originalId: message.id,
                targetTag,
            });
            const proxiedMessage = {
                id: proxyId,
                request: message.request,
            };
            this.sendToClient(targetWs, proxiedMessage);
        }
        else {
            // One-way messages or responses go directly
            this.sendToClient(targetWs, message);
        }
    }
    /**
     * Handle response from webapp to a request from an applet
     */
    handleResponseFromWebapp(message) {
        if (!(0, types_1.isResponseMessage)(message))
            return;
        const pending = this.pendingRequests.get(message.id);
        if (!pending) {
            console.log(`No pending request found for response ID: ${message.id}`);
            return;
        }
        this.pendingRequests.delete(message.id);
        // Send response back to original applet with original ID
        const originalResponse = {
            id: pending.originalId,
            response: message.response,
        };
        this.sendToClient(pending.source, originalResponse);
    }
    /**
     * Send a message to a specific client
     */
    sendToClient(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            const msgType = message.response?.type || message.type || 'unknown';
            console.log(`[timing] router: sending ${msgType} to client`);
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Broadcast a message to all connected clients
     */
    broadcast(message) {
        for (const [ws] of this.clients) {
            this.sendToClient(ws, message);
        }
    }
    /**
     * Get status information
     */
    getStatus() {
        const appletNames = [];
        for (const [, client] of this.clients) {
            if (client.type === 'applet' && client.registration) {
                appletNames.push(client.registration.name);
            }
        }
        const webapps = [];
        for (const [tag, _ws] of this.webappClients.entries()) {
            webapps.push({
                tag,
                connectedAt: this.webappConnectedAt.get(tag) || 0,
                isDefault: tag === this.defaultWebappTag,
            });
        }
        // Sort by connection time (oldest first)
        webapps.sort((a, b) => a.connectedAt - b.connectedAt);
        return {
            webapps,
            applets: appletNames,
        };
    }
}
exports.MessageRouter = MessageRouter;
//# sourceMappingURL=router.js.map