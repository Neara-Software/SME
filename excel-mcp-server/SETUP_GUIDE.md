# Excel MCP Server - Setup Guide for Claude Code

This guide walks you through setting up the **Excel Analyzer MCP server** in Claude Code. Once configured, Claude can directly read and analyze Excel files — including formulas, VBA macros, named ranges, and cell dependencies.

## Prerequisites

- **Claude Code** installed and working (CLI or VS Code extension)
- **Python 3.10+** installed
- **uv** (Python package manager) installed

### Installing uv (if you don't have it)

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via Homebrew
brew install uv
```

Verify it's installed:

```bash
uv --version
```

## Step 1: Get the Server Code

Clone or copy the `excel-mcp-server` folder to a location on your machine. The folder should contain:

```
excel-mcp-server/
  excel_mcp_server.py    # The MCP server
  pyproject.toml          # Python project config & dependencies
```

For this guide, we'll assume you placed it at:

```
~/Downloads/excel-mcp-server
```

Adjust the path below if you put it somewhere else.

## Step 2: Install Dependencies

Open a terminal, navigate to the server folder, and let `uv` set up the virtual environment:

```bash
cd ~/Downloads/excel-mcp-server
uv sync
```

This will create a `.venv` folder and install the required packages:
- `mcp>=1.0.0` (Model Context Protocol SDK)
- `openpyxl>=3.1.0` (Excel file parsing)
- `oletools>=0.60` (VBA macro extraction)

## Step 3: Configure Claude Code

You need to add the MCP server to your Claude Code settings. Run this command in your terminal:

```bash
claude mcp add excel-analyzer \
  -s user \
  -- uv --directory ~/Downloads/excel-mcp-server run python excel_mcp_server.py
```

**What this does:**
- Registers an MCP server named `excel-analyzer`
- `-s user` makes it available across all your projects (use `-s project` if you only want it for a specific project)
- Tells Claude Code to launch the server using `uv run` so it picks up the virtual environment automatically

### Alternative: Manual Configuration

If you prefer to edit the config file directly, open `~/.claude.json` and add the following inside the `"mcpServers"` object under your project or user settings:

```json
"excel-analyzer": {
  "command": "uv",
  "args": [
    "--directory",
    "/absolute/path/to/excel-mcp-server",
    "run",
    "python",
    "excel_mcp_server.py"
  ]
}
```

**Important:** Replace `/absolute/path/to/excel-mcp-server` with the actual absolute path on your machine (e.g., `/Users/yourname/Downloads/excel-mcp-server`).

## Step 4: Verify It Works

1. Restart Claude Code (or open a new terminal session)
2. Start Claude and ask it something like:

```
List the sheets in ~/path/to/some-file.xlsx
```

If configured correctly, Claude will use the MCP tools to read the Excel file.

## Available Tools

Once connected, Claude has access to these tools:

| Tool | Description |
|---|---|
| `list_sheets` | List all sheets in a workbook |
| `get_all_formulas` | Extract all formulas, organized by sheet |
| `get_cell_info` | Get detailed info about a specific cell (formula, value, dependencies) |
| `get_named_ranges` | List all named ranges / defined names |
| `get_vba_code` | Extract VBA macro code from `.xlsm` files |
| `analyze_formula_chain` | Trace formula dependencies (what a cell depends on + what depends on it) |
| `get_sheet_structure` | Get sheet structure (dimensions, data regions, merged cells) |
| `search_formulas` | Search for formulas containing specific functions (e.g., VLOOKUP, SUM) |
| `get_full_analysis` | Comprehensive analysis of an entire workbook |

## Example Prompts

Once the MCP is running, try asking Claude:

- "Analyze all the formulas in `~/Documents/budget.xlsx`"
- "Extract the VBA code from `~/Documents/macro-workbook.xlsm`"
- "What does cell D15 in Sheet1 of `report.xlsx` depend on?"
- "Search for all VLOOKUP formulas in `data.xlsx`"
- "Give me a full analysis of `~/spreadsheet.xlsx`"

## Supported File Types

- `.xlsx` (standard Excel)
- `.xlsm` (macro-enabled Excel — required for VBA extraction)
- `.xltx` (Excel template)
- `.xltm` (macro-enabled Excel template)

## Troubleshooting

**"MCP server not found" or tools not appearing:**
- Make sure `uv` is in your PATH — run `which uv` to check
- If using the manual config, ensure the path is absolute (starts with `/`)
- Restart Claude Code after config changes

**"File not found" errors when analyzing Excel files:**
- Use the full absolute path to the Excel file
- Tilde (`~`) expansion should work, but if it doesn't, use the full path

**VBA extraction not working:**
- Make sure the file is `.xlsm` (not `.xlsx`)
- The `oletools` package must be installed (it should be via `uv sync`)

**uv not found:**
- If `uv` is installed but not found, use the full path in your config. Find it with `which uv` (e.g., `/Users/yourname/.local/bin/uv`) and replace `"command": "uv"` with `"command": "/Users/yourname/.local/bin/uv"`
