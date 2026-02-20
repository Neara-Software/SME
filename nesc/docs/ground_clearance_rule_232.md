# Rule 232 — Ground Clearance

## Overview

NESC Rule 232 specifies minimum vertical clearances of wires, conductors, and cables above ground or rails. The implementation checks whether cable sag under worst-case environmental conditions meets the required clearance distances from Table 232-1.

The check is **span-level** (not pole-level) and runs per terrain category crossed by the span. It is currently **disabled** in SpanCheckManager pending further validation.

---

## Architecture

### Dependency Chain

```
nesc~PoleLoadingSpanCheckManager
    |
    +-- ground_clearance_output  (currently null / disabled)
            |
            +-- nesc~GroundClearanceRule232Calculator
                    |
                    +-- nesc~GroundClearanceRule232Processing
                            |
                            +-- points (from SpanStack.u_ground_clearance_points)
                            |       |
                            |       +-- nesc~GroundClearanceRule232PointsProcessing
                            |               (generates terrain-classified measurement volumes)
                            |
                            +-- simulations (FEA under worst-case environments)
                            +-- distance (measured cable-to-ground distances)
                            +-- required_distance (Table 232-1 lookup)
                            +-- results (per-terrain margin calculation)
```

### Data Flow

1. **PointsProcessing** generates 3D measurement volumes along the span corridor, classified by terrain (railroad, road, default)
2. **Processing** runs FEA simulations under worst-case environments (max temperature + Rule 230B ice loading)
3. For each terrain category, it measures the vertical distance from each cable catenary to the ground points
4. It looks up the required clearance from Table 232-1 based on terrain and voltage group
5. The worst margin (minimum of actual - required) across all terrains becomes the check result

---

## File Structure

```
nesc/
├── Types/
│   ├── nesc~GroundClearanceRule232Calculator.neara.hjson
│   ├── nesc~GroundClearanceRule232Processing.neara.hjson
│   ├── nesc~GroundClearanceRule232PointsProcessing.neara.hjson
│   ├── SpanStack.neara.hjson                    (corridor width properties + points formula)
│   └── nesc~PoleLoadingSpanCheckManager.neara.hjson  (ground_clearance_output, currently disabled)
└── DataTables/
    └── nesc~232-1 ground clearance.neara.hjson
```

---

## Calculator — `nesc~GroundClearanceRule232Calculator`

Token: `nesc~ct_GroundClearanceRule232Calculator`

Thin wrapper that delegates to Processing and shapes output.

| Field | Description |
|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` — injected span context |
| `processing` | `make_immutable_record("nesc~GroundClearanceRule232Processing", ...)` |
| `output` | `{pass, worst_result, worst_margin}` — pass if worst margin >= 0ft |

### Output Structure

```
{
  pass: true | false,
  worst_result: { terrain_category, environment, vertical_distance, required_distance, margin },
  worst_margin: <distance>,
}
```

---

## Processing — `nesc~GroundClearanceRule232Processing`

Token: `nesc~ct_GroundClearanceRule232Processing`

Core logic for Rule 232. Determines environments, runs simulations, measures distances, and compares against Table 232-1.

### Environment Selection

Two environments are evaluated (worst case across both):

| Environment | Condition | Temperature | Ice |
|---|---|---|---|
| `env_max_temp` | Always | max(operating temp, 120F) | None |
| `env_230b` | Heavy loading district | 0F | 0.5" radial |
| `env_230b` | Medium loading district | 15F | 0.25" radial |
| `env_230b` | Light loading district | Not generated | — |

Loading district is determined by `geo_query` against `dt_nesc_loading_zones` at both the pole and strain section geometry.

### Voltage Group Classification

Determines which Table 232-1 column to use:

| Group | Condition | Table Column |
|---|---|---|
| `COMMS` | conductor_class = "COMMS" | col1 |
| `Neutral_Msgr` | voltage = 0kV | col1 |
| `Supply_0_750V` | 0 < voltage <= 750V | col3 |
| `Distribution` | 750V < voltage < 57kV | col4 |
| `57kV` | voltage >= 57kV | col4 |
| `115kV` | voltage >= 115kV | col4 |
| `230kV` | voltage >= 229.5kV | col4 |

### Key Fields

| Field | Description |
|---|---|
| `distance` | Measured vertical distances from each cable catenary to ground points, per terrain × environment |
| `environments` | `filter_nulls(list(env_max_temp, env_230b))` — 1 or 2 environments |
| `points` | Terrain-classified measurement points from `SpanStack.u_ground_clearance_points` |
| `required_distance` | Per-terrain lookup from Table 232-1 by voltage group |
| `results` | Per-terrain record with `{terrain_category, environment, vertical_distance, required_distance, margin}` |
| `simulations` | FEA results per environment via `simulate_strain_section_fea` |
| `voltage_group` | Classification string used for Table 232-1 column selection |
| `worst_margin` | `min(results[].margin)` — the controlling clearance deficit or surplus |
| `worst_result` | The result record with the smallest margin |

---

## PointsProcessing — `nesc~GroundClearanceRule232PointsProcessing`

Token: `nesc~ct_GroundClearanceRule232PointsProcessing`

Generates terrain-classified 3D measurement volumes along the span corridor. Instantiated per SpanStack via the `u_ground_clearance_points` formula.

### Terrain Detection

| Terrain | Detection Method | Data Table |
|---|---|---|
| Track of railroad | `geo_intersect` against railroad geometries | `dt_or_railroads` |
| Roads and other areas subject to truck traffic | `geo_query` within 5m of road geometries | `dt_oregon_public_roads` |
| Other areas traversed by vehicles | Always generated (default) | — |

### Corridor Width Properties

Three user-configurable corridor widths on SpanStack control the buffer around each terrain feature:

| Property | SpanStack Field | Type | Default |
|---|---|---|---|
| Default corridor | `nesc~u_default_corridor_width` | `real` (dimensionless) | 1m fallback |
| Railroad corridor | `nesc~u_railroad_corridor_width` | `real` (dimensionless) | 1m fallback |
| Road corridor | `nesc~u_road_corridor_width` | `real` (dimensionless) | 1m fallback |

The dimensionless real value is converted to a distance via `width * 1m` for use in `linestring_to_volume`. If null (not set by user), defaults to 1m.

### Key Fields

| Field | Description |
|---|---|
| `bay` | `type_only("~SpanStack")` — the span stack being measured |
| `default_buffer` | `if(default_corridor_width <> null, default_corridor_width * 1m, 1m)` |
| `default_points` | `categorize_volume(linestring_to_volume(...), "Other areas traversed by vehicles", "ground")` |
| `is_railroad` | Boolean — span intersects railroad geometry |
| `is_road` | Boolean — span within 5m of road geometry |
| `points` | List of `{category, points}` records — one per detected terrain type |
| `railroad_points` | Volume along railroad geometries, categorized as "Track of railroad" |
| `road_points` | Volume along road geometries, categorized as "Roads and other areas subject to truck traffic" |

---

## Data Table — `nesc~232-1 ground clearance`

NESC Table 232-1: minimum vertical clearances in feet. All columns are `real` with `unit: "ft"`.

| Column | Description |
|---|---|
| `description` | Terrain category (text key for lookup) |
| `col1` | Communication conductors / neutral messengers |
| `col2` | (Reserved) |
| `col3` | Supply cables 0–750V |
| `col4` | Supply cables >750V (all voltage tiers) |

### Data

| Terrain | col1 | col2 | col3 | col4 |
|---|---|---|---|---|
| Track of railroad | 23.5 | 24.0 | 24.5 | 26.5 |
| Roads and other areas subject to truck traffic | 15.5 | 16.0 | 16.5 | 18.5 |
| Driveways, parking areas, and alleys | 15.5 | 16.0 | 16.5 | 18.5 |
| Other areas traversed by vehicles | 15.5 | 16.0 | 16.5 | 18.5 |
| Spaces and ways subject to pedestrians only | 9.5 | 12.0 | 12.5 | 14.5 |
| Water areas not suitable for sailboating | 14.0 | 14.5 | 15.0 | 17.0 |
| Water areas suitable for sailboating <20 acres | 17.5 | 18.0 | 18.5 | 20.5 |
| Water areas suitable for sailboating 20–200 acres | 25.5 | 26.0 | 26.5 | 28.5 |
| Water areas suitable for sailboating 200–2000 acres | 31.5 | 32.0 | 32.5 | 34.5 |
| Water areas suitable for sailboating >2000 acres | 37.5 | 38.0 | 38.5 | 40.5 |

---

## SpanCheckManager Integration

`nesc~PoleLoadingSpanCheckManager` has a `ground_clearance_output` field that is currently disabled (returns `null`). To enable:

```dim
make_immutable_record(
  "nesc~GroundClearanceRule232Calculator",
  model_input: model_input,
).output
```

---

## Required Geospatial Data Tables

| Data Table | Description |
|---|---|
| `dt_nesc_loading_zones` | NESC loading district boundaries (Heavy/Medium/Light) |
| `dt_or_railroads` | Railroad geometries for terrain classification |
| `dt_oregon_public_roads` | Road geometries for terrain classification |

---

## Status & Known Issues

- **Disabled** — `ground_clearance_output` returns `null` in SpanCheckManager
- Voltage groups 57kV/115kV/230kV all map to col4 — no voltage adder implemented yet for Table 232-1 footnotes
- Only three terrain categories are auto-detected (railroad, road, default) — water areas and pedestrian-only areas are not yet classified
