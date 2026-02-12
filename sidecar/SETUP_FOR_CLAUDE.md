# Dim CLI Setup Guide (For Claude Code)

This document is intended for Claude Code to follow when setting up the `dim` CLI tool for a user.

## Prerequisites Check

Before starting, verify the user's system:

### Step 1: Check Node.js

```bash
node --version
```

**If Node.js is not installed or version is < 18:**

macOS (with Homebrew):
```bash
brew install node
```

macOS (without Homebrew - install Homebrew first):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

Ubuntu/Debian:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Windows: Direct the user to download from https://nodejs.org/

### Step 2: Verify npm

```bash
npm --version
```

This should be available after Node.js is installed.

## Installation

### Step 3: Install Dependencies

From this directory (`tools/sidecar`):
```bash
npm install
```

### Step 4: Build the CLI

```bash
npm run build
```

### Step 5: Install Globally

```bash
npm link
```

**If npm link fails with permission errors (macOS/Linux):**

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
```

Add to shell config (`~/.zshrc` or `~/.bashrc`):
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

Reload shell and retry:
```bash
source ~/.zshrc  # or ~/.bashrc
npm link
```

### Step 6: Verify Installation

```bash
dim --help
```

If `dim: command not found`, check that npm's global bin directory is in PATH:
```bash
echo $PATH | grep -q "$(npm bin -g)" || echo "Add $(npm bin -g) to your PATH"
```

## Usage

### Connecting to the Web App

1. Open the Neara web app in your browser
2. Go to the Debug panel (usually in developer tools or a debug menu)
3. Click "Connect to Sidecar" - this starts the sidecar server

### Basic Commands

Once connected:

```bash
# Check connection
dim healthcheck

# List connected browser tabs
dim tabs

# Stream console logs from webapp
dim logs

# Stop logs after 10 seconds
dim logs -t 10

# Filter logs by keyword
dim logs error
```

### Syncing Module Files

The `dim sync` command syncs type definitions and reports from your local disk to the running webapp.

**Directory Structure Required:**
```
your-module-folder/
  Types/
    MyType.dim
    MyType.neara.json
    AnotherType.dim
  Reports/
    MyReport.neara.json
```

**Sync all types:**
```bash
dim sync --module <moduleKey> --path /path/to/module --types all
```

**Sync specific types:**
```bash
dim sync --module <moduleKey> --path /path/to/module --types TypeName1 TypeName2
```

**Sync reports:**
```bash
dim sync --module <moduleKey> --path /path/to/module --reports all
```

**Sync both types and reports:**
```bash
dim sync --module <moduleKey> --path /path/to/module --types all --reports all
```

### Evaluating Dim Code

```bash
# Simple expression
dim eval --code "1 + 2"

# With namespace (for module-specific fields)
dim eval --code "my_custom_field" --namespace myModule
```

### Working with Multiple Tabs

When you have multiple browser tabs connected:

```bash
# List all connected tabs
dim tabs

# Target a specific tab
dim healthcheck --tab tab-x7k2

# Set default tab via environment variable
export DIM_TAB=tab-x7k2
dim healthcheck  # uses tab-x7k2
```

## Troubleshooting

### "dim: command not found"

1. Verify npm link succeeded: `ls -la $(npm bin -g)/dim`
2. Check PATH includes npm global bin: `echo $PATH`
3. Try running with full path: `$(npm bin -g)/dim --help`

### "Connection timeout" or "Not connected to sidecar"

1. Ensure the Neara web app is open
2. Ensure "Connect to Sidecar" was clicked in the Debug panel
3. Check sidecar is running on port 8086: `lsof -i :8086`

### Build errors

```bash
npm install  # reinstall dependencies
npm run build  # rebuild
```

## What Can Be Synced

Currently supported:
- **Types** (`.dim` files and `.neara.json` schema files)
- **Reports** (`.neara.json` report definitions)

Not yet supported (coming soon):
- Custom Widgets
- Data Tables
- Database Tables
