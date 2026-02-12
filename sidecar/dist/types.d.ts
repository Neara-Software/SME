/**
 * Message types matching the Dart WebSocketClient protocol
 */
export interface OneWayMessage {
    type: string;
    payload: Record<string, unknown>;
}
export interface RequestMessage {
    id: number;
    request: {
        type: string;
        payload: Record<string, unknown>;
    };
}
export interface ResponseMessage {
    id: number;
    response: {
        type: string;
        payload: Record<string, unknown>;
    };
}
export interface PingMessage {
    type: 'ping';
}
export interface PongMessage {
    type: 'pong';
}
export type WebSocketMessage = OneWayMessage | RequestMessage | ResponseMessage | PingMessage | PongMessage;
export declare function isOneWayMessage(msg: WebSocketMessage): msg is OneWayMessage;
export declare function isRequestMessage(msg: WebSocketMessage): msg is RequestMessage;
export declare function isResponseMessage(msg: WebSocketMessage): msg is ResponseMessage;
export declare function isPingMessage(msg: WebSocketMessage): msg is PingMessage;
export declare function isPongMessage(msg: WebSocketMessage): msg is PongMessage;
/**
 * Client types
 */
export type ClientType = 'webapp' | 'applet';
export interface AppletRegistration {
    name: string;
    handles: string[];
}
export interface ConnectedClient {
    id: string;
    type: ClientType;
    tag?: string;
    registration?: AppletRegistration;
}
/**
 * Routing metadata for messages
 */
export interface RoutingMeta {
    source?: string;
    target?: string;
}
/**
 * Registration message sent by applets
 */
export interface RegisterMessage extends OneWayMessage {
    type: 'register';
    payload: {
        name: string;
        handles: string[];
    };
}
export declare function isRegisterMessage(msg: WebSocketMessage): msg is RegisterMessage;
/**
 * Tabs request message - lists connected webapp tabs
 */
export declare function isTabsRequestMessage(msg: WebSocketMessage): msg is OneWayMessage;
//# sourceMappingURL=types.d.ts.map