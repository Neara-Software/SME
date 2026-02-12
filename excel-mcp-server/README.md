# Excel MCP Server

An MCP (Model Context Protocol) server that allows Claude to analyze Excel files, including:

- **Cell formulas** - Extract and analyze all formulas
- **VBA macros** - Extract macro code from .xlsm files
- **Named ranges** - List all defined names
- **Formula dependencies** - Trace what cells depend on what
- **Sheet structure** - Understand workbook layout

## Installation

### Prerequisites

- Python 3.10+
- `uv` package manager (recommended) or `pip`

### Step 1: Clone/Copy the Server

```bash
# Create directory
mkdir -p ~/mcp-servers/excel-mcp-server
cd ~/mcp-servers/excel-mcp-server

# Copy the files (excel_mcp_server.py and pyproject.toml)
# Or clone from your repo
```

### Step 2: Install Dependencies

**Using uv (recommended):**
```bash
cd ~/mcp-servers/excel-mcp-server
uv venv
uv pip install -e .
```

**Using pip:**
```bash
cd ~/mcp-servers/excel-mcp-server
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install mcp openpyxl oletools
```

## Configuration

### For Claude Code (VS Code)

Claude Code auto-discovers MCP servers. Add to your VS Code settings or workspace `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "excel-analyzer": {
      "command": "uv",
      "args": [
        "--directory",
        "/Users/YOUR_USERNAME/mcp-servers/excel-mcp-server",
        "run",
        "python",
        "excel_mcp_server.py"
      ]
    }
  }
}
```

**Alternative using uvx:**
```json
{
  "mcpServers": {
    "excel-analyzer": {
      "command": "uvx",
      "args": [
        "--from",
        "/Users/YOUR_USERNAME/mcp-servers/excel-mcp-server",
        "excel-mcp-server"
      ]
    }
  }
}
```

### For Claude Desktop

Edit your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "excel-analyzer": {
      "command": "uv",
      "args": [
        "--directory",
        "/Users/YOUR_USERNAME/mcp-servers/excel-mcp-server",
        "run",
        "python",
        "excel_mcp_server.py"
      ]
    }
  }
}
```

**Important:** Replace `/Users/YOUR_USERNAME/` with your actual path!

### Verify Installation

After configuring, restart Claude Desktop or reload VS Code. Then ask:

> "What Excel analysis tools do you have available?"

Claude should list the 9 available tools.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_sheets` | List all sheets in a workbook |
| `get_all_formulas` | Extract all formulas (optionally filtered by sheet) |
| `get_cell_info` | Get detailed info about a specific cell |
| `get_named_ranges` | List all named ranges/defined names |
| `get_vba_code` | Extract VBA macro code (.xlsm files) |
| `analyze_formula_chain` | Trace dependencies for a formula |
| `get_sheet_structure` | Get sheet layout and statistics |
| `search_formulas` | Search for formulas containing specific text |
| `get_full_analysis` | Comprehensive workbook analysis |

## Usage Examples

Once configured, you can ask Claude:

### Basic Analysis
> "Analyze the Excel file at ~/Documents/calculations.xlsm"

### Formula Extraction
> "Show me all formulas in the 'Calculations' sheet of ~/work/model.xlsx"

### VBA Analysis
> "Extract and explain the VBA code in ~/projects/macro_workbook.xlsm"

### Formula Dependencies
> "What cells depend on cell B5 in the 'Summary' sheet of my workbook?"

### Search
> "Find all VLOOKUP formulas in ~/data/report.xlsx"

## Troubleshooting

### "oletools not installed"
```bash
pip install oletools
# or
uv pip install oletools
```

### Server not connecting
1. Check the file path in your config is correct
2. Ensure Python 3.10+ is available
3. Check Claude Desktop/VS Code logs for errors
4. Try running the server manually to test:
   ```bash
   cd ~/mcp-servers/excel-mcp-server
   python excel_mcp_server.py
   ```

### Permission errors on macOS
Grant Terminal/VS Code full disk access in System Preferences → Security & Privacy → Privacy → Full Disk Access

## File Support

| Extension | Formulas | VBA | Notes |
|-----------|----------|-----|-------|
| `.xlsx` | ✅ | ❌ | Standard Excel |
| `.xlsm` | ✅ | ✅ | Macro-enabled |
| `.xltx` | ✅ | ❌ | Template |
| `.xltm` | ✅ | ✅ | Macro template |
| `.xls` | ❌ | ❌ | Legacy format not supported |

## Security Note

This server has read access to Excel files on your filesystem. It does not modify files. The VBA extraction uses oletools which is a well-established security analysis library.

## License

MIT
