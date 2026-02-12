/**
 * Message types matching the Dart WebSocketClient protocol
 */

// One-way message: {type: "...", payload: {...}}
export interface OneWayMessage {
  type: string;
  payload: Record<string, unknown>;
}

// Request message: {id: N, request: {type: "...", payload: {...}}}
export interface RequestMessage {
  id: number;
  request: {
    type: string;
    payload: Record<string, unknown>;
  };
}

// Response message: {id: N, response: {type: "...", payload: {...}}}
export interface ResponseMessage {
  id: number;
  response: {
    type: string;
    payload: Record<string, unknown>;
  };
}

// Ping/pong messages
export interface PingMessage {
  type: 'ping';
}

export interface PongMessage {
  type: 'pong';
}

// Union of all message types
export type WebSocketMessage = OneWayMessage | RequestMessage | ResponseMessage | PingMessage | PongMessage;

// Type guards
export function isOneWayMessage(msg: WebSocketMessage): msg is OneWayMessage {
  return 'type' in msg && 'payload' in msg && msg.type !== 'ping' && msg.type !== 'pong';
}

export function isRequestMessage(msg: WebSocketMessage): msg is RequestMessage {
  return 'id' in msg && 'request' in msg;
}

export function isResponseMessage(msg: WebSocketMessage): msg is ResponseMessage {
  return 'id' in msg && 'response' in msg;
}

export function isPingMessage(msg: WebSocketMessage): msg is PingMessage {
  return 'type' in msg && (msg as PingMessage).type === 'ping';
}

export function isPongMessage(msg: WebSocketMessage): msg is PongMessage {
  return 'type' in msg && (msg as PongMessage).type === 'pong';
}

/**
 * Client types
 */
export type ClientType = 'webapp' | 'applet';

export interface AppletRegistration {
  name: string;
  handles: string[]; // message types this applet handles
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
  source?: string;  // Set by router on messages from webapps
  target?: string;  // Set by CLI to route to specific tab
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

export function isRegisterMessage(msg: WebSocketMessage): msg is RegisterMessage {
  return isOneWayMessage(msg) && msg.type === 'register';
}

/**
 * Tabs request message - lists connected webapp tabs
 */
export function isTabsRequestMessage(msg: WebSocketMessage): msg is OneWayMessage {
  return isOneWayMessage(msg) && msg.type === 'tabs';
}
