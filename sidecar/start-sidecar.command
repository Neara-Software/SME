#!/bin/bash
# Double-click this file to start the Neara sidecar server
# Works from any location - no need to cd first

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==================================="
echo "  Neara Sidecar Server"
echo "==================================="
echo ""

# Check/install bun
if ! command -v bun &> /dev/null; then
    echo "Bun not found. Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo ""
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    bun install
    echo ""
fi

# Build if needed
if [ ! -f "dist/server.js" ]; then
    echo "Building..."
    bun run build
    echo ""
fi

# Link to make 'dim' available globally (first run only)
if ! command -v dim &> /dev/null; then
    echo "Adding 'dim' command to your PATH..."
    bun link
    echo ""
    echo "NOTE: Open a new terminal window to use the 'dim' command."
    echo ""
fi

echo "Starting server on ws://localhost:8086"
echo "Press Ctrl+C to stop"
echo ""

bun run start
