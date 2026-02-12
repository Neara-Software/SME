#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const fs = __importStar(require("fs"));
const nodePath = __importStar(require("path"));
const DEFAULT_SIDECAR_URL = 'ws://localhost:8086';
/**
 * Dim CLI Tool
 *
 * Connects to the sidecar server and sends commands to the web app.
 *
 * Usage:
 *   dim-cli test --module <moduleKey>
 *   dim-cli analyze --file <filePath>
 *   dim-cli status
 */
class DimCli {
    constructor(sidecarUrl = DEFAULT_SIDECAR_URL, targetTab = null) {
        this.ws = null;
        this.targetTab = null;
        this.responseResolver = null;
        this.messageHandlers = new Map();
        this.sidecarUrl = sidecarUrl;
        this.targetTab = targetTab;
    }
    /**
     * Register a handler for one-way messages of a specific type
     */
    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }
    /**
     * Unregister a handler for one-way messages
     */
    offMessage(type) {
        this.messageHandlers.delete(type);
    }
    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new ws_1.WebSocket(this.sidecarUrl);
            this.ws.on('open', () => {
                resolve();
            });
            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });
            this.ws.on('error', (error) => {
                reject(error);
            });
            this.ws.on('close', () => {
                this.ws = null;
            });
            // Timeout for connection
            setTimeout(() => {
                if (this.ws?.readyState !== ws_1.WebSocket.OPEN) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);
        });
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Handle ping
            if (message.type === 'ping') {
                this.ws?.send(JSON.stringify({ type: 'pong' }));
                return;
            }
            // Handle response
            if (message.id !== undefined && message.response && this.responseResolver) {
                this.responseResolver(message.response.payload);
                this.responseResolver = null;
                return;
            }
            // Handle one-way messages (e.g., console_log_entries)
            if (message.type && message.payload) {
                const handler = this.messageHandlers.get(message.type);
                if (handler) {
                    handler(message.payload);
                }
            }
        }
        catch (error) {
            console.error('Failed to handle message:', error);
        }
    }
    async sendRequest(type, payload) {
        if (!this.ws || this.ws.readyState !== ws_1.WebSocket.OPEN) {
            throw new Error('Not connected to sidecar');
        }
        return new Promise((resolve, reject) => {
            this.responseResolver = resolve;
            const request = {
                id: Date.now(),
                request: {
                    type,
                    payload,
                },
            };
            // Add routing if targeting a specific tab
            if (this.targetTab) {
                request.routing = { target: this.targetTab };
            }
            this.ws.send(JSON.stringify(request));
            // Timeout for response
            setTimeout(() => {
                if (this.responseResolver) {
                    this.responseResolver = null;
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }
    sendMessage(type, payload) {
        if (!this.ws || this.ws.readyState !== ws_1.WebSocket.OPEN) {
            throw new Error('Not connected to sidecar');
        }
        const message = {
            type,
            payload,
        };
        this.ws.send(JSON.stringify(message));
    }
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
// Command handlers
async function handleTest(cli, args) {
    const moduleIndex = args.indexOf('--module');
    if (moduleIndex === -1 || !args[moduleIndex + 1]) {
        return { success: false, error: 'Missing --module argument' };
    }
    const moduleKey = args[moduleIndex + 1];
    console.log(`Running tests for module: ${moduleKey}`);
    try {
        const result = await cli.sendRequest('test', { moduleKey });
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleAnalyze(cli, args) {
    const moduleIndex = args.indexOf('--module');
    if (moduleIndex === -1 || !args[moduleIndex + 1]) {
        return { success: false, error: 'Missing --module argument' };
    }
    const moduleKey = args[moduleIndex + 1];
    // Optional --types filter
    let typeNames;
    const typesIndex = args.indexOf('--types');
    if (typesIndex !== -1 && args[typesIndex + 1]) {
        typeNames = args[typesIndex + 1].split(',').map(t => t.trim());
    }
    console.log(`Analyzing module: ${moduleKey}`);
    if (typeNames) {
        console.log(`Filtering by types: ${typeNames.join(', ')}`);
    }
    try {
        const startTime = performance.now();
        const result = await cli.sendRequest('analyze', { moduleKey, typeNames });
        const elapsed = performance.now() - startTime;
        console.log(`[timing] analyze request completed in ${elapsed.toFixed(1)}ms`);
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleSync(cli, args) {
    const moduleIndex = args.indexOf('--module');
    if (moduleIndex === -1 || !args[moduleIndex + 1]) {
        return { success: false, error: 'Missing --module argument' };
    }
    const moduleKey = args[moduleIndex + 1];
    const pathIndex = args.indexOf('--path');
    if (pathIndex === -1 || !args[pathIndex + 1]) {
        return { success: false, error: 'Missing --path argument' };
    }
    const modulePath = args[pathIndex + 1];
    // --types flag: required to sync types
    // --types all → sync all types
    // --types Foo Bar → sync specific types
    // No --types → sync NO types
    const typesIndex = args.indexOf('--types');
    const typesProvided = typesIndex !== -1;
    let typeNames;
    let syncAllTypes = false;
    if (typesProvided) {
        typeNames = [];
        for (let i = typesIndex + 1; i < args.length && !args[i].startsWith('--'); i++) {
            typeNames.push(args[i]);
        }
        if (typeNames.length === 1 && typeNames[0].toLowerCase() === 'all') {
            syncAllTypes = true;
            typeNames = undefined; // No filter = all types
        }
        else if (typeNames.length === 0) {
            return { success: false, error: '--types requires arguments. Use --types all or --types <name1> <name2>' };
        }
    }
    // --reports flag: required to sync reports
    // --reports all → sync all reports
    // --reports Foo Bar → sync specific reports
    // No --reports → sync NO reports
    const reportsIndex = args.indexOf('--reports');
    const reportsProvided = reportsIndex !== -1;
    let reportNames;
    let syncAllReports = false;
    if (reportsProvided) {
        reportNames = [];
        for (let i = reportsIndex + 1; i < args.length && !args[i].startsWith('--'); i++) {
            reportNames.push(args[i]);
        }
        if (reportNames.length === 1 && reportNames[0].toLowerCase() === 'all') {
            syncAllReports = true;
            reportNames = undefined; // No filter = all reports
        }
        else if (reportNames.length === 0) {
            return { success: false, error: '--reports requires arguments. Use --reports all or --reports <name1> <name2>' };
        }
    }
    // Require at least one of --types or --reports
    if (!typesProvided && !reportsProvided) {
        return { success: false, error: 'Must specify --types and/or --reports. Use --types all to sync all types, or --types <name1> <name2> for specific types.' };
    }
    const typesDir = nodePath.join(modulePath, 'Types');
    const reportsDir = nodePath.join(modulePath, 'Reports');
    const hasTypesDir = fs.existsSync(typesDir);
    const hasReportsDir = fs.existsSync(reportsDir);
    // Check that requested directories exist
    if (typesProvided && !hasTypesDir) {
        return { success: false, error: `Types directory not found in: ${modulePath}` };
    }
    if (reportsProvided && !hasReportsDir) {
        return { success: false, error: `Reports directory not found in: ${modulePath}` };
    }
    console.log(`Syncing module: ${moduleKey} from ${modulePath}`);
    if (typesProvided) {
        if (syncAllTypes) {
            console.log('Syncing all types');
        }
        else {
            console.log(`Syncing types: ${typeNames.join(', ')}`);
        }
    }
    if (reportsProvided) {
        if (syncAllReports) {
            console.log('Syncing all reports');
        }
        else {
            console.log(`Syncing reports: ${reportNames.join(', ')}`);
        }
    }
    // Collect ALL type names on disk (before filtering)
    const allTypeNamesOnDisk = [];
    const typeFiles = {};
    if (typesProvided && hasTypesDir) {
        const typeFileList = fs.readdirSync(typesDir);
        // First pass: collect all type names on disk
        for (const filename of typeFileList) {
            if (filename.endsWith('.dim') || filename.includes('.neara.')) {
                const typeName = filename.split('.')[0];
                if (!allTypeNamesOnDisk.includes(typeName)) {
                    allTypeNamesOnDisk.push(typeName);
                }
            }
        }
        // Second pass: read files (with optional filtering)
        for (const filename of typeFileList) {
            if (!filename.endsWith('.dim') && !filename.includes('.neara.')) {
                continue;
            }
            // Filter by type names if provided
            if (typeNames && typeNames.length > 0) {
                const typeName = filename.split('.')[0];
                if (!typeNames.includes(typeName)) {
                    continue;
                }
            }
            const filePath = nodePath.join(typesDir, filename);
            const content = fs.readFileSync(filePath, 'utf-8');
            const virtualPath = `${moduleKey}/Types/${filename}`;
            typeFiles[virtualPath] = content;
            console.log(`  Including type: ${filename}`);
        }
    }
    // Collect ALL report names on disk (before filtering)
    const allReportNamesOnDisk = [];
    const reportFiles = {};
    if (reportsProvided && hasReportsDir) {
        const reportFileList = fs.readdirSync(reportsDir);
        // First pass: collect all report names on disk
        for (const filename of reportFileList) {
            if (filename.includes('.neara.')) {
                const reportName = filename.split('.')[0];
                if (!allReportNamesOnDisk.includes(reportName)) {
                    allReportNamesOnDisk.push(reportName);
                }
            }
        }
        // Second pass: read files (with optional filtering)
        for (const filename of reportFileList) {
            if (!filename.includes('.neara.')) {
                continue;
            }
            // Filter by report names if provided
            if (reportNames && reportNames.length > 0) {
                const reportName = filename.split('.')[0];
                if (!reportNames.includes(reportName)) {
                    continue;
                }
            }
            const filePath = nodePath.join(reportsDir, filename);
            const content = fs.readFileSync(filePath, 'utf-8');
            const virtualPath = `${moduleKey}/Reports/${filename}`;
            reportFiles[virtualPath] = content;
            console.log(`  Including report: ${filename}`);
        }
    }
    // Only delete unlisted types/reports when syncing ALL (--types all / --reports all)
    const deleteUnlistedTypes = syncAllTypes;
    const deleteUnlistedReports = syncAllReports;
    if (deleteUnlistedTypes && allTypeNamesOnDisk.length > 0) {
        console.log(`Types on disk: ${allTypeNamesOnDisk.join(', ')}`);
        console.log(`Will delete types not on disk`);
    }
    if (deleteUnlistedReports && allReportNamesOnDisk.length > 0) {
        console.log(`Reports on disk: ${allReportNamesOnDisk.join(', ')}`);
        console.log(`Will delete reports not on disk`);
    }
    if (Object.keys(typeFiles).length === 0 && Object.keys(reportFiles).length === 0) {
        return { success: false, error: 'No type or report files found to sync' };
    }
    console.log(`Syncing ${Object.keys(typeFiles).length} type file(s) and ${Object.keys(reportFiles).length} report file(s)...`);
    try {
        const totalStartTime = performance.now();
        // Send types one at a time
        for (const [virtualPath, content] of Object.entries(typeFiles)) {
            const filename = virtualPath.split('/').pop();
            console.log(`  Syncing type: ${filename}...`);
            const startTime = performance.now();
            await cli.sendRequest('sync', {
                moduleKey,
                typeFiles: { [virtualPath]: content },
            });
            const elapsed = performance.now() - startTime;
            console.log(`    Done in ${elapsed.toFixed(1)}ms`);
        }
        // Send reports one at a time
        for (const [virtualPath, content] of Object.entries(reportFiles)) {
            const filename = virtualPath.split('/').pop();
            console.log(`  Syncing report: ${filename}...`);
            const startTime = performance.now();
            await cli.sendRequest('sync', {
                moduleKey,
                reportFiles: { [virtualPath]: content },
            });
            const elapsed = performance.now() - startTime;
            console.log(`    Done in ${elapsed.toFixed(1)}ms`);
        }
        const totalElapsed = performance.now() - totalStartTime;
        console.log(`[timing] all sync requests completed in ${totalElapsed.toFixed(1)}ms`);
        return {
            success: true,
            data: {
                typeFileCount: Object.keys(typeFiles).length,
                reportFileCount: Object.keys(reportFiles).length,
            },
        };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleStatus(cli) {
    console.log('Getting status...');
    try {
        const result = await cli.sendRequest('status', {});
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleHealthcheck(cli) {
    console.log('Sending healthcheck...');
    try {
        const result = await cli.sendRequest('healthcheck', {});
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleWorkspace(cli, args) {
    // Parse subcommand: list, get, create, delete, update, sections
    const subcommand = args[1];
    if (!subcommand) {
        return { success: false, error: 'Missing workspace subcommand. Use: list, get, create, delete, update, sections' };
    }
    try {
        switch (subcommand) {
            case 'list': {
                console.log('Listing workspaces...');
                const result = await cli.sendRequest('workspace', { subtype: 'list' });
                return { success: true, data: result };
            }
            case 'get': {
                const id = args[2];
                if (!id || id.startsWith('--')) {
                    return { success: false, error: 'Missing workspace ID. Usage: workspace get <id>' };
                }
                console.log(`Getting workspace: ${id}`);
                const result = await cli.sendRequest('workspace', { subtype: 'get', id });
                return { success: true, data: result };
            }
            case 'create': {
                const title = args[2];
                if (!title || title.startsWith('--')) {
                    return { success: false, error: 'Missing workspace title. Usage: workspace create <title>' };
                }
                console.log(`Creating workspace: ${title}`);
                const result = await cli.sendRequest('workspace', { subtype: 'create', title });
                return { success: true, data: result };
            }
            case 'delete': {
                const id = args[2];
                if (!id || id.startsWith('--')) {
                    return { success: false, error: 'Missing workspace ID. Usage: workspace delete <id>' };
                }
                console.log(`Deleting workspace: ${id}`);
                const result = await cli.sendRequest('workspace', { subtype: 'delete', id });
                return { success: true, data: result };
            }
            case 'update': {
                const id = args[2];
                if (!id || id.startsWith('--')) {
                    return { success: false, error: 'Missing workspace ID. Usage: workspace update <id> [--title <title>] [--layout <json>]' };
                }
                const layout = {};
                // Parse --title
                const titleIndex = args.indexOf('--title');
                if (titleIndex !== -1 && args[titleIndex + 1]) {
                    layout.title = args[titleIndex + 1];
                }
                // Parse --layout (expects JSON string)
                const layoutIndex = args.indexOf('--layout');
                if (layoutIndex !== -1 && args[layoutIndex + 1]) {
                    try {
                        layout.layout = JSON.parse(args[layoutIndex + 1]);
                    }
                    catch {
                        return { success: false, error: 'Invalid JSON for --layout' };
                    }
                }
                if (Object.keys(layout).length === 0) {
                    return { success: false, error: 'Must provide --title and/or --layout' };
                }
                console.log(`Updating workspace: ${id}`);
                const result = await cli.sendRequest('workspace', { subtype: 'update', id, layout });
                return { success: true, data: result };
            }
            case 'sections': {
                console.log('Listing available sections...');
                const result = await cli.sendRequest('workspace', { subtype: 'sections' });
                return { success: true, data: result };
            }
            default:
                return { success: false, error: `Unknown workspace subcommand: ${subcommand}` };
        }
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleDocs(cli, args) {
    // Parse subcommand: categories | functions | function
    const subcommand = args[1];
    if (!subcommand) {
        return { success: false, error: 'Missing docs subcommand. Use: categories, functions, or function' };
    }
    try {
        switch (subcommand) {
            case 'categories': {
                console.log('Getting documentation categories...');
                const result = await cli.sendRequest('docs', { action: 'categories' });
                return { success: true, data: result };
            }
            case 'functions': {
                // Optional --category filter
                const categoryIndex = args.indexOf('--category');
                const category = categoryIndex !== -1 ? args[categoryIndex + 1] : undefined;
                if (category) {
                    console.log(`Getting functions in category: ${category}`);
                }
                else {
                    console.log('Getting all public functions...');
                }
                const result = await cli.sendRequest('docs', { action: 'functions', category });
                return { success: true, data: result };
            }
            case 'function': {
                // Required function name
                const name = args[2];
                if (!name || name.startsWith('--')) {
                    return { success: false, error: 'Missing function name. Usage: docs function <name>' };
                }
                console.log(`Getting documentation for function: ${name}`);
                const result = await cli.sendRequest('docs', { action: 'function', name });
                return { success: true, data: result };
            }
            default:
                return { success: false, error: `Unknown docs subcommand: ${subcommand}` };
        }
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
/**
 * Format a log entry for display
 */
function formatLogEntry(entry) {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString('en-US', { hour12: false });
    const level = entry.level.padEnd(7);
    const logger = entry.loggerName || 'root';
    let output = `[${timeStr}] ${level} ${logger}: ${entry.message}`;
    if (entry.error) {
        output += `\n  Error: ${entry.error}`;
    }
    if (entry.stackTrace) {
        output += `\n  Stack: ${entry.stackTrace.split('\n').slice(0, 3).join('\n        ')}`;
    }
    return output;
}
/**
 * Handle logs command - stream console logs from the webapp
 */
async function handleLogs(cli, args) {
    // Parse optional filter (first positional arg after 'logs')
    let filter;
    const filterIndex = 1; // args[0] is 'logs'
    if (args[filterIndex] && !args[filterIndex].startsWith('-')) {
        filter = args[filterIndex];
    }
    // Parse optional timeout with -t flag
    let timeoutSeconds;
    const timeoutIndex = args.indexOf('-t');
    if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
        const parsed = parseInt(args[timeoutIndex + 1], 10);
        if (isNaN(parsed) || parsed <= 0) {
            return { success: false, error: 'Invalid timeout: must be a positive number of seconds' };
        }
        timeoutSeconds = parsed;
    }
    console.log('Starting console log stream...');
    if (filter) {
        console.log(`Filter: "${filter}"`);
    }
    if (timeoutSeconds) {
        console.log(`Timeout: ${timeoutSeconds} seconds`);
    }
    console.log('Press Ctrl+C to stop\n');
    // Set up message handler for log entries
    let entryCount = 0;
    cli.onMessage('console_log_entries', (payload) => {
        const data = payload;
        if (data.historical) {
            console.log(`--- Historical logs (${data.count} entries) ---`);
        }
        for (const entry of data.entries) {
            console.log(formatLogEntry(entry));
            entryCount++;
        }
        if (data.historical) {
            console.log(`--- Live logs ---`);
        }
    });
    try {
        // Start streaming
        const startResult = await cli.sendRequest('console_log', {
            subtype: 'start',
            filter,
        });
        if (!startResult.success) {
            return { success: false, error: startResult.message || 'Failed to start log streaming' };
        }
        // Wait for timeout or Ctrl+C
        await new Promise((resolve) => {
            // Handle Ctrl+C
            const cleanup = () => {
                process.removeListener('SIGINT', sigintHandler);
                resolve();
            };
            const sigintHandler = () => {
                console.log('\nStopping...');
                cleanup();
            };
            process.on('SIGINT', sigintHandler);
            // Handle timeout
            if (timeoutSeconds) {
                setTimeout(() => {
                    console.log(`\nTimeout reached (${timeoutSeconds}s)`);
                    cleanup();
                }, timeoutSeconds * 1000);
            }
        });
        // Stop streaming
        await cli.sendRequest('console_log', { subtype: 'stop' });
        return {
            success: true,
            data: { message: 'Log streaming stopped', entriesReceived: entryCount },
        };
    }
    catch (error) {
        // Try to stop streaming on error
        try {
            await cli.sendRequest('console_log', { subtype: 'stop' });
        }
        catch {
            // Ignore cleanup errors
        }
        return { success: false, error: String(error) };
    }
}
async function handleEval(cli, args) {
    // Parse --code (required)
    const codeIndex = args.indexOf('--code');
    if (codeIndex === -1 || !args[codeIndex + 1]) {
        return { success: false, error: 'Missing --code argument. Usage: eval --code "<dim expression>" [--namespace <ns>]' };
    }
    const code = args[codeIndex + 1];
    // Parse --namespace (optional)
    const namespaceIndex = args.indexOf('--namespace');
    const namespace = namespaceIndex !== -1 ? args[namespaceIndex + 1] : undefined;
    console.log(`Evaluating dim code: ${code}`);
    if (namespace) {
        console.log(`Namespace: ${namespace}`);
    }
    try {
        const result = await cli.sendRequest('eval', { code, namespace });
        if (result.success) {
            console.log(`\nType: ${result.type}`);
            console.log(`Result: ${result.result}`);
            return { success: true, data: result };
        }
        else {
            if (result.parseError) {
                console.error(`Parse error: ${result.error}`);
            }
            else if (result.compileError) {
                console.error(`Compile error: ${result.error}`);
            }
            else if (result.runtimeError) {
                console.error(`Runtime error: ${result.error}`);
            }
            else {
                console.error(`Error: ${result.error}`);
            }
            return { success: false, error: result.error };
        }
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
async function handleTabs(cli) {
    console.log('Listing connected tabs...');
    return new Promise((resolve) => {
        // Set up handler for tabs_list response
        cli.onMessage('tabs_list', (payload) => {
            cli.offMessage('tabs_list');
            const data = payload;
            if (data.tabs.length === 0) {
                console.log('\nNo webapp tabs connected');
                resolve({ success: true, data });
                return;
            }
            console.log(`\nConnected tabs (${data.count}):`);
            console.log('');
            for (const tab of data.tabs) {
                const connectedAt = new Date(tab.connectedAt);
                const timeStr = connectedAt.toLocaleTimeString('en-US', { hour12: false });
                const defaultMarker = tab.isDefault ? ' (default)' : '';
                console.log(`  ${tab.tag}${defaultMarker}`);
                console.log(`    Connected at: ${timeStr}`);
            }
            resolve({ success: true, data });
        });
        // Send the tabs request
        cli.sendMessage('tabs', {});
        // Timeout
        setTimeout(() => {
            cli.offMessage('tabs_list');
            resolve({ success: false, error: 'Timeout waiting for tabs list' });
        }, 5000);
    });
}
/**
 * Parse a canonical field name into qualified type and field names.
 *
 * Format:
 *   TypeName.field_name                         -> type: TypeName, field: field_name
 *   namespace~TypeName.field_name               -> type: namespace~TypeName, field: namespace~field_name
 *   namespace~TypeName.otherNamespace~field_name -> type: namespace~TypeName, field: otherNamespace~field_name
 */
function parseCanonicalFieldName(canonicalName) {
    const lastDotIndex = canonicalName.lastIndexOf('.');
    if (lastDotIndex === -1) {
        throw new Error('Invalid canonical name format. Expected: [namespace~]TypeName.[fieldNamespace~]fieldName');
    }
    const typePart = canonicalName.substring(0, lastDotIndex);
    const fieldPart = canonicalName.substring(lastDotIndex + 1);
    // Type part is already in qualified form
    const qualifiedType = typePart;
    // For field part: if no namespace prefix, inherit from type
    let qualifiedField;
    if (fieldPart.includes('~')) {
        // Field has explicit namespace
        qualifiedField = fieldPart;
    }
    else {
        // Field inherits type's namespace (if any)
        const typeNsSeparator = typePart.indexOf('~');
        if (typeNsSeparator !== -1) {
            const typeNamespace = typePart.substring(0, typeNsSeparator);
            qualifiedField = `${typeNamespace}~${fieldPart}`;
        }
        else {
            qualifiedField = fieldPart;
        }
    }
    return { qualifiedType, qualifiedField };
}
async function handleFieldUsages(cli, args) {
    // Check if using new canonical name format (positional arg) or legacy --type/--field format
    const typeIndex = args.indexOf('--type');
    const fieldIndex = args.indexOf('--field');
    let qualifiedType;
    let qualifiedField;
    let displayName;
    if (typeIndex === -1 && fieldIndex === -1) {
        // New format: canonical name as first positional argument
        const canonicalName = args[1];
        if (!canonicalName || canonicalName.startsWith('--')) {
            return {
                success: false,
                error: 'Missing canonical field name. Usage: field-usages <canonicalName>\n' +
                    'Examples:\n' +
                    '  field-usages Pole.height\n' +
                    '  field-usages pyth~Pole.u_adjacent_poles\n' +
                    '  field-usages pyth~Pole.other~u_extension_formula_in_other'
            };
        }
        try {
            const parsed = parseCanonicalFieldName(canonicalName);
            qualifiedType = parsed.qualifiedType;
            qualifiedField = parsed.qualifiedField;
            displayName = canonicalName;
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    else {
        // Legacy format: --type, --field, --namespace
        if (typeIndex === -1 || !args[typeIndex + 1]) {
            return { success: false, error: 'Missing --type argument. Usage: field-usages --type <typeName> --field <fieldName> [--namespace <ns>]' };
        }
        if (fieldIndex === -1 || !args[fieldIndex + 1]) {
            return { success: false, error: 'Missing --field argument. Usage: field-usages --type <typeName> --field <fieldName> [--namespace <ns>]' };
        }
        const typeName = args[typeIndex + 1];
        const fieldName = args[fieldIndex + 1];
        const namespaceIndex = args.indexOf('--namespace');
        const namespace = namespaceIndex !== -1 ? args[namespaceIndex + 1] : undefined;
        // Qualify names with namespace if provided
        qualifiedType = namespace ? `${namespace}~${typeName}` : typeName;
        qualifiedField = namespace ? `${namespace}~${fieldName}` : fieldName;
        displayName = `${qualifiedType}.${qualifiedField}`;
    }
    console.log(`Querying field usages for ${displayName}`);
    try {
        const result = await cli.sendRequest('field_usages', {
            type: qualifiedType,
            field: qualifiedField,
            namespace: undefined // Send undefined since we're sending qualified names
        });
        if (result.success) {
            const usages = result.usages;
            console.log(`\nFound ${usages.length} usage(s):\n`);
            for (const usage of usages) {
                const type = usage.type;
                const description = usage.description;
                console.log(`  [${type}] ${description}`);
                // Show additional details based on type
                if (type === 'field' && usage.typeName && usage.fieldName) {
                    console.log(`    Type: ${usage.typeName}, Field: ${usage.fieldName}`);
                }
                else if (type === 'report' && usage.reportTitle) {
                    console.log(`    Report: ${usage.reportTitle}`);
                }
                else if (type === 'parameter' && usage.parameterTitle) {
                    console.log(`    Parameter: ${usage.parameterTitle}`);
                }
                else if (type === 'generic' && usage.count) {
                    console.log(`    Count: ${usage.count}`);
                }
                console.log('');
            }
            return { success: true, data: result };
        }
        else {
            console.error(`Error: ${result.error}`);
            return { success: false, error: result.error };
        }
    }
    catch (error) {
        return { success: false, error: String(error) };
    }
}
function printUsage() {
    console.log(`
Dim CLI - Command-line interface for Neara dim language

Usage:
  dim-cli <command> [options]

Commands:
  healthcheck                                                   Check if web app is connected
  tabs                                                          List connected webapp tabs
  field-usages <canonicalName>                                  Find usages of a field (see examples below)
  test --module <moduleKey>                                     Run tests for a module
  analyze --module <moduleKey> [--types]                        Analyze custom fields for compile errors
  sync --module <moduleKey> --path <dir> --types|--reports ...  Sync type and report files from disk to webapp
  docs categories                                               List documentation categories
  docs functions [--category <name>]                            List functions (optionally by category)
  docs function <name>                                          Get documentation for a function
  eval --code "<code>" [--namespace <ns>]                       Evaluate dim code on the Model
  logs [filter] [-t seconds]                                    Stream console logs from webapp
  workspace list                                                List all workspaces
  workspace get <id>                                            Get workspace layout structure
  workspace create <title>                                      Create a new workspace
  workspace delete <id>                                         Delete a workspace
  workspace update <id> [--title <title>] [--layout <json>]     Update workspace title or layout
  workspace sections                                            List available panel sections
  status                                                        Get sidecar status

Options:
  --sidecar <url>              Sidecar WebSocket URL (default: ws://localhost:8086)
  --tab <tag>                  Target a specific webapp tab (use 'tabs' to list)
  --types <type1,type2,...>    Filter analyze by type names (comma-separated)
  --path <directory>           Path to module directory on disk (for sync)
  --help                       Show this help message

Environment Variables:
  DIM_TAB                      Default tab to target (overridden by --tab)

Logs options:
  [filter]                     Filter logs by message or logger name (case-insensitive)
  -t <seconds>                 Stop streaming after specified seconds

Sync options (must specify at least one):
  --types all                  Sync all types from disk
  --types <t1> <t2>            Sync specific types by name
  --reports all                Sync all reports from disk
  --reports <r1> <r2>          Sync specific reports by name

Examples:
  dim tabs                                          List connected webapp tabs
  dim healthcheck                                   Check default tab is connected
  dim healthcheck --tab dev                         Check specific tab is connected
  dim field-usages Pole.height                      Find usages of a field
  dim field-usages pyth~Pole.u_adjacent_poles       Find usages of a namespaced field
  dim field-usages pyth~Pole.other~u_formula        Find usages when field is in different namespace
  dim logs                                          Stream all logs (history + live)
  dim logs error                                    Filter logs containing "error"
  dim logs -t 5                                     Collect logs for 5 seconds
  dim logs warning -t 10                            Filter warnings for 10 seconds
  dim eval --code "1 + 2"                           Evaluate a simple expression
  dim eval --code "my_field" --namespace myModule   Evaluate in a specific namespace
`);
}
// Main entry point
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help')) {
        printUsage();
        process.exit(0);
    }
    // Get sidecar URL from args or environment
    let sidecarUrl = DEFAULT_SIDECAR_URL;
    const urlIndex = args.indexOf('--sidecar');
    if (urlIndex !== -1 && args[urlIndex + 1]) {
        sidecarUrl = args[urlIndex + 1];
    }
    // Get target tab from args or environment
    let targetTab = null;
    const tabIndex = args.indexOf('--tab');
    if (tabIndex !== -1 && args[tabIndex + 1]) {
        targetTab = args[tabIndex + 1];
    }
    else if (process.env.DIM_TAB) {
        targetTab = process.env.DIM_TAB;
    }
    const command = args[0];
    const cli = new DimCli(sidecarUrl, targetTab);
    try {
        console.log(`Connecting to sidecar at ${sidecarUrl}...`);
        await cli.connect();
        console.log('Connected');
        let result;
        switch (command) {
            case 'healthcheck':
                result = await handleHealthcheck(cli);
                break;
            case 'tabs':
                result = await handleTabs(cli);
                break;
            case 'field-usages':
                result = await handleFieldUsages(cli, args);
                break;
            case 'test':
                result = await handleTest(cli, args);
                break;
            case 'analyze':
                result = await handleAnalyze(cli, args);
                break;
            case 'sync':
                result = await handleSync(cli, args);
                break;
            case 'docs':
                result = await handleDocs(cli, args);
                break;
            case 'eval':
                result = await handleEval(cli, args);
                break;
            case 'logs':
                result = await handleLogs(cli, args);
                break;
            case 'workspace':
                result = await handleWorkspace(cli, args);
                break;
            case 'status':
                result = await handleStatus(cli);
                break;
            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
                process.exit(1);
        }
        if (result.success) {
            console.log('Result:', JSON.stringify(result.data, null, 2));
            process.exit(0);
        }
        else {
            console.error('Error:', result.error);
            process.exit(1);
        }
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
    finally {
        cli.close();
    }
}
main();
//# sourceMappingURL=cli.js.map