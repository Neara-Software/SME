#!/usr/bin/env node

import { WebSocket } from 'ws';
import * as readline from 'readline';

const DEFAULT_SIDECAR_URL = 'ws://localhost:8085';

/**
 * LSP Stdio Bridge
 *
 * Bridges LSP JSON-RPC requests from stdin/stdout to the sidecar WebSocket server.
 * This allows Claude Code (and other LSP clients) to interact with the Neara web app.
 *
 * Usage: node lsp-bridge.js --stdio
 */

interface LspMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

class LspBridge {
  private ws: WebSocket | null = null;
  private sidecarUrl: string;
  private pendingRequests: Map<number | string, (response: unknown) => void> = new Map();
  private buffer: string = '';
  private contentLength: number | null = null;

  constructor(sidecarUrl: string = DEFAULT_SIDECAR_URL) {
    this.sidecarUrl = sidecarUrl;
  }

  async start(): Promise<void> {
    await this.connectToSidecar();
    this.setupStdinReader();
  }

  private async connectToSidecar(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.sidecarUrl);

      this.ws.on('open', () => {
        this.log('Connected to sidecar');

        // Register as LSP applet
        this.ws!.send(JSON.stringify({
          type: 'register',
          payload: {
            name: 'lsp',
            handles: ['lsp'],
          },
        }));

        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleSidecarMessage(data.toString());
      });

      this.ws.on('close', () => {
        this.log('Disconnected from sidecar');
        process.exit(0);
      });

      this.ws.on('error', (error) => {
        this.log(`WebSocket error: ${error.message}`);
        reject(error);
      });
    });
  }

  private setupStdinReader(): void {
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.processBuffer();
    });

    process.stdin.on('end', () => {
      this.log('stdin closed');
      process.exit(0);
    });
  }

  private processBuffer(): void {
    while (true) {
      if (this.contentLength === null) {
        // Look for Content-Length header
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
          return; // Need more data
        }

        const header = this.buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          this.log(`Invalid header: ${header}`);
          this.buffer = this.buffer.substring(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1], 10);
        this.buffer = this.buffer.substring(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) {
        return; // Need more data
      }

      const content = this.buffer.substring(0, this.contentLength);
      this.buffer = this.buffer.substring(this.contentLength);
      this.contentLength = null;

      this.handleLspMessage(content);
    }
  }

  private handleLspMessage(content: string): void {
    try {
      const message: LspMessage = JSON.parse(content);
      this.log(`LSP request: ${message.method || 'response'} id=${message.id}`);

      // Send to sidecar as an LSP message
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // If this is a request (has method), send as request and wait for response
        if (message.method !== undefined && message.id !== undefined) {
          // Send as a WebSocket request
          const wsRequest = {
            id: typeof message.id === 'number' ? message.id : parseInt(message.id as string, 10) || 0,
            request: {
              type: 'lsp',
              payload: message,
            },
          };
          this.ws.send(JSON.stringify(wsRequest));
        } else {
          // Notification or response - send as one-way message
          const wsMessage = {
            type: 'lsp',
            payload: message,
          };
          this.ws.send(JSON.stringify(wsMessage));
        }
      }
    } catch (error) {
      this.log(`Failed to parse LSP message: ${error}`);
    }
  }

  private handleSidecarMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle ping
      if (message.type === 'ping') {
        this.ws?.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Handle LSP response
      if (message.id !== undefined && message.response) {
        const lspResponse = message.response.payload;
        if (lspResponse) {
          this.sendLspResponse(lspResponse);
        }
        return;
      }

      // Handle one-way LSP message
      if (message.type === 'lsp' && message.payload) {
        this.sendLspResponse(message.payload);
      }
    } catch (error) {
      this.log(`Failed to handle sidecar message: ${error}`);
    }
  }

  private sendLspResponse(message: unknown): void {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    process.stdout.write(header + content);
  }

  private log(message: string): void {
    // Write logs to stderr so they don't interfere with LSP protocol on stdout
    process.stderr.write(`[lsp-bridge] ${message}\n`);
  }
}

// Main entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for --stdio flag
  if (!args.includes('--stdio')) {
    console.error('Usage: dim-lsp --stdio');
    console.error('');
    console.error('LSP stdio bridge for Neara dim language.');
    console.error('Connects to the sidecar server and bridges LSP requests to the web app.');
    process.exit(1);
  }

  // Get sidecar URL from args or environment
  let sidecarUrl = DEFAULT_SIDECAR_URL;
  const urlIndex = args.indexOf('--sidecar');
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    sidecarUrl = args[urlIndex + 1];
  }

  const bridge = new LspBridge(sidecarUrl);
  await bridge.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
