# Dim CLI - AI Installation Guide

This file guides Claude Code through installing the `dim` CLI tool.

## What This Is

The `dim` CLI connects to the Neara web app via WebSocket to run commands like:
- `dim test --module <key>` - Run expression tests
- `dim analyze --module <key>` - Analyze for compile errors
- `dim sync --module <key> --path <dir>` - Sync type files from disk
- `dim docs function <name>` - Query function documentation
- `dim logs [filter] [-t seconds]` - Stream console logs from webapp

## Installation Steps

**Follow these steps in order. Run each command and check the result before proceeding.**

### Step 1: Check Node.js

Run:
```bash
node --version
```

**If Node.js is not installed or version is < 18:**

macOS:
```bash
brew install node
```

Ubuntu/Debian:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Windows (inform user):
```
Download and install from https://nodejs.org/
```

### Step 2: Check npm

Run:
```bash
npm --version
```

This should be available after Node.js is installed.

### Step 3: Install Dependencies

Run from this directory (`tools/sidecar`):
```bash
npm install
```

Expected: Creates `node_modules/` directory with dependencies.

### Step 4: Build the CLI

Run:
```bash
npm run build
```

Expected: Creates `dist/` directory with compiled JavaScript files.

### Step 5: Install Globally

Run:
```bash
npm link
```

Expected: Creates global symlinks for `dim`, `dim-cli`, `dim-lsp`, and `neara-sidecar`.

**If npm link fails with permission errors:**

macOS/Linux - fix npm prefix:
```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
```

Then add to shell config (~/.zshrc or ~/.bashrc):
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

Then reload shell and retry:
```bash
source ~/.zshrc  # or ~/.bashrc
npm link
```

### Step 6: Verify Installation

Run:
```bash
dim --help
```

Expected: Shows usage information for the dim CLI.

If `dim: command not found`, check that the npm global bin directory is in PATH:
```bash
npm bin -g
```

Add that path to your shell's PATH if needed.

## Troubleshooting

### "dim: command not found" after npm link

1. Find where npm installs global binaries:
   ```bash
   npm bin -g
   ```

2. Check if that directory is in PATH:
   ```bash
   echo $PATH
   ```

3. If not, add it to ~/.zshrc or ~/.bashrc:
   ```bash
   export PATH="$(npm bin -g):$PATH"
   ```

### Permission denied during npm link

Use the npm-global prefix approach shown in Step 5, or run with sudo (not recommended).

### Build errors

Ensure TypeScript compiles:
```bash
npx tsc --version
npm run build
```

If errors about missing types, run `npm install` again.

## Usage

After installation, the web app's sidecar server must be running:

1. Open the Neara web app
2. Go to Debug panel
3. Click "Connect to Sidecar" (starts the server)

Then run commands:
```bash
dim healthcheck          # Verify connection
dim status               # Check sidecar status
dim test --module <key>  # Run tests for a module
dim logs                 # Stream console logs (history + live)
dim logs error           # Filter logs containing "error"
dim logs -t 5            # Collect logs for 5 seconds
```
