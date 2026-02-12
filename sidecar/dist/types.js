"use strict";
/**
 * Message types matching the Dart WebSocketClient protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOneWayMessage = isOneWayMessage;
exports.isRequestMessage = isRequestMessage;
exports.isResponseMessage = isResponseMessage;
exports.isPingMessage = isPingMessage;
exports.isPongMessage = isPongMessage;
exports.isRegisterMessage = isRegisterMessage;
exports.isTabsRequestMessage = isTabsRequestMessage;
// Type guards
function isOneWayMessage(msg) {
    return 'type' in msg && 'payload' in msg && msg.type !== 'ping' && msg.type !== 'pong';
}
function isRequestMessage(msg) {
    return 'id' in msg && 'request' in msg;
}
function isResponseMessage(msg) {
    return 'id' in msg && 'response' in msg;
}
function isPingMessage(msg) {
    return 'type' in msg && msg.type === 'ping';
}
function isPongMessage(msg) {
    return 'type' in msg && msg.type === 'pong';
}
function isRegisterMessage(msg) {
    return isOneWayMessage(msg) && msg.type === 'register';
}
/**
 * Tabs request message - lists connected webapp tabs
 */
function isTabsRequestMessage(msg) {
    return isOneWayMessage(msg) && msg.type === 'tabs';
}
//# sourceMappingURL=types.js.map