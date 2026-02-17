# Cable Thermal

Thermal rating calculations for underground power cables.

Implements:
- **IEC 60287** — Steady-state current rating
- **IEC 60853** — Cyclic rating factors
- **FEM** — 2D/3D finite element thermal modelling
- **CYMCAP** database ingestion from Access (.mdb/.accdb) files
- **CIGRE** benchmark validation

## Setup

```bash
uv sync --all-extras
```

## Usage

```bash
uv run pytest
```
