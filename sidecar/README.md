# Dim CLI

Command-line interface for the Neara dim language. Connects to the web app via a WebSocket sidecar server.

## Installation

```bash
cd tools/sidecar
npm install
npm run build
npm link  # Installs 'dim' command globally
```

## Usage

Start the sidecar server first:
```bash
dim-sidecar
# or: npm start
```

Then connect the web app to the sidecar (Debug panel > "Connect to Sidecar").

### Commands

```bash
# Check connection
dim healthcheck

# Sync type files from disk to webapp
dim sync --module <moduleKey> --path <dir> [--types type1 type2]

# Analyze custom fields for compile errors
dim analyze --module <moduleKey> [--types type1,type2]

# Query function documentation
dim docs categories                      # List all categories
dim docs functions [--category Math]     # List functions
dim docs function power                  # Get docs for a function

# Run tests
dim test --module <moduleKey>

# Check sidecar status
dim status
```

### Options

- `--sidecar <url>` - WebSocket URL (default: ws://localhost:8086)
- `--help` - Show help

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     WebSocket     ┌─────────────┐
│   dim CLI   │ ─────────────────▶ │   Sidecar   │ ◀───────────────▶ │   Web App   │
│  (applet)   │                    │   Server    │                    │  (browser)  │
└─────────────┘                    └─────────────┘                    └─────────────┘
```

The sidecar server acts as a message router between CLI tools and the web app.
