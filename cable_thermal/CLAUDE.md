# Cable Thermal — AI Instructions

## Project Overview
Underground cable thermal rating calculations. Python 3.12+, managed with uv.

## Structure
- `src/cable_thermal/` — Main package (src layout)
- `tests/` — pytest test suite
- `data/sample/` — Sample CYMCAP databases for testing
- `notebooks/` — Jupyter notebooks for exploration

## Conventions
- Use Pydantic v2 models for data validation
- Type annotations on all public functions
- Tests mirror source structure: `src/cable_thermal/db/` → `tests/test_db/`
- IEC clause references in docstrings where applicable (e.g., "IEC 60287-1-1, Eq. 2.1")

## Commands
- `uv sync --all-extras` — Install all dependencies
- `uv run pytest` — Run tests
- `uv run ruff check src/ tests/` — Lint
- `uv run mypy src/` — Type check

## Key Dependencies
- `pyodbc` — Access database connectivity (Windows ODBC driver)
- `pydantic` — Data validation and models
- `numpy` — Numerical computation
- `scipy` — Sparse solvers (FEM phases)
- `jinja2` — LaTeX template rendering (reporting)
