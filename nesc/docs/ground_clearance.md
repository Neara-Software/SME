# NESC Rule 232-1 — Ground Clearance

## Standard Reference

NESC Rule 232-1 specifies minimum vertical clearances of wires, conductors, and cables above ground, roadways, rails, and water surfaces. Clearance requirements vary by terrain category and voltage level. The check ensures conductors maintain safe distances under worst-case sag conditions (maximum temperature and ice loading).

### Table 232-1 — Minimum Clearances (feet)

| Terrain | Col 1 | Col 2 | Col 3 | Col 4 |
|---|---|---|---|---|
| Track of railroad | 23.5 | 24.0 | 24.5 | 26.5 |
| Roads and other areas subject to truck traffic | 15.5 | 16.0 | 16.5 | 18.5 |
| Driveways, parking areas, and alleys | 15.5 | 16.0 | 16.5 | 18.5 |
| Other areas traversed by vehicles | 15.5 | 16.0 | 16.5 | 18.5 |
| Spaces and ways subject to pedestrians only | 9.5 | 12.0 | 12.5 | 14.5 |
| Water areas not suitable for sailboating | 14.0 | 14.5 | 15.0 | 17.0 |
| Water areas suitable for sailboating < 20 acres | 17.5 | 18.0 | 18.5 | 20.5 |
| Water areas suitable for sailboating 20–200 acres | 25.5 | 26.0 | 26.5 | 28.5 |
| Water areas suitable for sailboating 200–2000 acres | 31.5 | 32.0 | 32.5 | 34.5 |
| Water areas suitable for sailboating > 2000 acres | 37.5 | 38.0 | 38.5 | 40.5 |

**Column mapping by voltage:**

| Voltage Group | Column |
|---|---|
| COMMS | col1 |
| Neutral/Messenger (0 kV) | col1 |
| Supply 0–750 V | col3 |
| Distribution (> 750 V), 57 kV, 115 kV, 230 kV | col4 |

### Pass/Fail Criterion

```
margin = measured_vertical_distance - required_clearance
```

If `margin < 0ft`, the span **fails**.

## Architecture

### Dependency Chain

```
SpanStack (corridor widths, bay geometry)
    │
    ▼
GroundClearanceBayPoints (obstacle detection → categorised 3D volumes)
    │
    ▼
Span → PoleLoadingSpanCheckManager → GroundClearanceCalculator → GroundClearanceProcessing
                                         │
                                         ▼
                                     {pass, worst_result, worst_margin}
```

The ground clearance check is a **span-level** check (not pole-level). It runs FEA on the strain section, then measures vertical distance from each cable's catenary to obstacle volumes generated along the span.

### File Structure

```
nesc/Types/
  nesc~GroundClearanceBayPoints.neara.hjson    Obstacle point generation (12 fields)
  nesc~GroundClearanceCalculator.neara.hjson    Calculator wrapper (3 fields)
  nesc~GroundClearanceProcessing.neara.hjson    Core computation (19 fields)
  SpanStack.neara.hjson                        Extension — corridor widths + bay points
  Span.neara.hjson                             Extension — u_pla_span_checks integration
  nesc~PoleLoadingSpanCheckManager.neara.hjson  Span check orchestration

nesc/DataTables/
  nesc~232-1 ground clearance.neara.hjson      Table 232-1 clearance values (TSV)
```

## BayPoints — `nesc~GroundClearanceBayPoints`

Token: `nesc~ct_GroundClearanceBayPoints`

Generates categorised 3D obstacle volumes along the span bay for ground clearance measurement. Each terrain type gets its own volume so the correct Table 232-1 row can be applied.

### Inputs

| Field | Type | Description |
|---|---|---|
| `bay` | `type_only("~SpanStack")` | The span stack (bay) providing geometry |
| `default_corridor_width` | `type_only(1)` | Injected corridor half-width (metres). Defaults to 1 m if null |
| `railroad_corridor_width` | `type_only(1)` | Injected corridor half-width for railroads. Defaults to 1 m if null |
| `road_corridor_width` | `type_only(1)` | Injected corridor half-width for roads. Defaults to 1 m if null |

### Terrain Detection

| Field | Method | Description |
|---|---|---|
| `is_railroad` | `geo_intersect(model().dt_or_railroads[].geometry, bay.geometry)` | True if any railroad geometry intersects the bay |
| `is_road` | `geo_query(model().dt_oregon_public_roads, bay.geometry, 5m)` | True if any public road is within 5 m of the bay |

`geo_intersect` checks for direct geometric intersection. `geo_query` performs a proximity search with a buffer distance. Railroads use intersection (exact overlap), roads use a 5 m proximity search.

### Buffer Computation

Each terrain type computes a buffer from its corridor width:

| Field | Formula |
|---|---|
| `default_buffer` | `if(default_corridor_width != null, default_corridor_width * 1m, 1m)` |
| `railroad_buffer` | `if(railroad_corridor_width != null, railroad_corridor_width * 1m, 1m)` |
| `road_buffer` | `if(road_corridor_width != null, road_corridor_width * 1m, 1m)` |

### 3D Volume Generation

Each terrain type generates a 3D volume using `linestring_to_volume`:

```
linestring_to_volume(geometry, buffer, 5m, 10m)
```

Arguments: geometry linestring, horizontal buffer, vertical depth below (5 m), vertical extent above (10 m). The volume is then categorised with `categorize_volume(volume, category_name, "ground")`.

**Railroad and road volumes** are built by querying nearby geometries, generating a volume for each, and combining them with `combine_volume`:

```
geo_query(model().dt_or_railroads, bay.geometry, 5ft)  →  geometries
broadcast(gmtry: geometries[].geometry, linestring_to_volume(gmtry, buffer, 5m, 10m))
combine_volume(...)  →  single merged volume
categorize_volume(volume, "Track of railroad", "ground")
```

**Default volume** uses the bay's own geometry directly:

```
linestring_to_volume(bay.geometry, default_buffer, 5m, 10m)
categorize_volume(..., "Other areas traversed by vehicles", "ground")
```

### Output — `points`

```
filter_nulls(list(
  if(is_railroad, {category: "Track of railroad", points: railroad_points}),
  if(is_road, {category: "Roads and other areas subject to truck traffic", points: road_points}),
  {category: "Other areas traversed by vehicles", points: default_points},
))
```

Always includes "Other areas traversed by vehicles" as baseline. Railroad and road entries are conditionally added when detected. The result is an array of `{category, points}` records used downstream by `GroundClearanceProcessing`.

## Calculator — `nesc~GroundClearanceCalculator`

Token: `nesc~ct_GroundClearanceCalculator`

Thin wrapper that instantiates Processing and shapes the output.

| Field | Type | Description |
|---|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` | Injected model input |
| `processing` | `make_immutable_record` | Instantiates `nesc~GroundClearanceProcessing` with `model_input` |
| `output` | record | Final output (see Output Structure below) |

### Output Structure

```
{
  pass:         processing.worst_margin >= 0ft
  worst_result: processing.worst_result
  worst_margin: processing.worst_margin
}
```

## Processing — `nesc~GroundClearanceProcessing`

Token: `nesc~ct_GroundClearanceProcessing`

Contains all computation logic. Fields are listed alphabetically per project convention.

### Inputs

| Field | Description |
|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` — span geometry, section, voltages, etc. |
| `points` | `model_input.span.stack.u_ground_clearance_points.points` — obstacle volumes from BayPoints |

### Loading District Classification

Uses geo-queries against `dt_nesc_loading_zones` to classify the loading district.

| Field | Description |
|---|---|
| `pole_check` | `geo_query(model().dt_nesc_loading_zones, model_input.span.pole1.geometry, 0ft)[].zonename` |
| `strain_section_check` | `geo_query(model().dt_nesc_loading_zones, model_input.span.section.geometry, 0ft)[].zonename` |
| `is_heavy` | True if pole or any strain section is in "Heavy Loading District" |
| `is_medium` | True if not heavy and pole is in "Medium Loading District" |
| `is_light` | True if not heavy/medium and pole is in "Light Loading District" |

### Environment Scenarios

Two environment scenarios are simulated:

| Field | Condition | Environment |
|---|---|---|
| `env_max_temp` | Always runs | `max(section.max_operating_temperature, 120°F)` — maximum sag from thermal expansion |
| `env_230b` | Heavy or Medium only | Rule 230B ice loading (Heavy: 0.5" ice @ 0°F; Medium: 0.25" ice @ 15°F) |

```
environments = filter_nulls(list(env_max_temp, env_230b))
```

`env_230b` is null for Light Loading District (no ice loading case), so Light districts only check max temperature.

#### env_max_temp Detail

Uses `make_environment(temperature:)`. If the section's `max_operating_temperature` exceeds 120°F, that value is used; otherwise defaults to 120°F.

#### env_230b Detail

| Loading District | Temperature | Ice Radial Thickness | Ice Density |
|---|---|---|---|
| Heavy | 0°F | 0.5 in | 56 lb/ft³ |
| Medium | 15°F | 0.25 in | 56 lb/ft³ |
| Light | *(not applicable — env_230b is null)* | | |

### Voltage Group Classification

Classifies the span's voltage into a group for Table 232-1 column selection:

| Condition | Group | Table Column |
|---|---|---|
| `conductor_class = "COMMS"` | `COMMS` | col1 |
| `voltage = 0 kV` | `Neutral_Msgr` | col1 |
| `voltage > 0 kV and <= 750 V` | `Supply_0_750V` | col3 |
| `voltage > 750 V` | `Distribution` | col4 |
| `voltage >= 57 kV` | `57kV` | col4 |
| `voltage >= 115 kV` | `115kV` | col4 |
| `voltage >= 229.5 kV` | `230kV` | col4 |

Classification is evaluated top-to-bottom (first match wins). The voltage thresholds cascade from highest to lowest.

### FEA Simulation

```
broadcast(
  env: environments,
  simulate_strain_section_fea(model_input.span.section, environment: env, network_solve: false),
)
```

Runs a strain section FEA simulation for each environment. Uses `simulate_strain_section_fea` (not `simulate_structure_fea` — this is a span-level check, not a pole-level check). `network_solve: false` means single-section analysis.

#### Span Report Extraction

For each environment, filters the simulation's `SpanReports` to find the report matching `model_input.span`:

```
filter(sim[].SpanReports, sim[].SpanReports[].span = model_input.span)
```

### Distance Measurement

For each terrain category and each environment, measures vertical distance from cable catenaries to the obstacle volume:

```
broadcast(
  pp: points,
  broadcast(
    env: environments,
    not_null(measure_distance(span_report[].CableReports[].catenary, pp.points)),
  ),
)
```

`measure_distance` returns the vertical distance between each cable's catenary and the obstacle points. `not_null` filters out any null measurements.

### Required Distance Lookup

For each terrain category, looks up the minimum clearance from Table 232-1:

```
find(model().nesc~dt_232_1_ground_clearance, description = terrain)
```

Then selects the column based on `voltage_group`:

| Voltage Group | Column |
|---|---|
| `COMMS`, `Neutral_Msgr` | `col1` |
| `Supply_0_750V` | `col3` |
| `Distribution`, `57kV`, `115kV`, `230kV` | `col4` |

### Results Aggregation

For each terrain category, finds the worst-case clearance across all environments:

```
min_by(dist, dist[].vertical_distance - required)
```

This selects the measurement with the smallest margin (closest to or below required clearance). Each result record contains:

```
{
  terrain_category:   "Track of railroad" | "Roads and other areas..." | etc.
  environment:        the environment that produced the worst margin
  vertical_distance:  measured clearance
  required_distance:  Table 232-1 minimum
  margin:             vertical_distance - required_distance
}
```

### Worst Result

| Field | Description |
|---|---|
| `worst_result` | `min_by(results, results[].margin)` — terrain with smallest margin |
| `worst_margin` | `worst_result.margin` (or `0ft` if `worst_result` is null) |

## CheckManager Integration

In `nesc~PoleLoadingSpanCheckManager`, ground clearance is wired as:

```
ground_clearance_output:
  make_immutable_record(
    "nesc~GroundClearanceCalculator",
    model_input: model_input,
  ).output
```

The span check manager creates `model_input` from the span:

```
model_input:
  make_immutable_record("nesc~PoleLoadingModelInput", span: span)
```

And is instantiated on the `Span` extension (`Span.neara.hjson`) via:

```
nesc~u_pla_span_checks:
  make_immutable_record("PoleLoadingSpanCheckManager", span: self)
```

### SpanStack Extension

`SpanStack.neara.hjson` adds three configurable properties and the bay points formula:

| Field | Type | Description |
|---|---|---|
| `nesc~u_default_corridor_width` | property (number) | Default corridor half-width (metres) |
| `nesc~u_railroad_corridor_width` | property (number) | Railroad corridor half-width (metres) |
| `nesc~u_road_corridor_width` | property (number) | Road corridor half-width (metres) |
| `nesc~u_ground_clearance_points` | formula | Instantiates `GroundClearanceBayPoints` with corridor widths |

## Data Tables

| DataTable | Description |
|---|---|
| `nesc~dt_232_1_ground_clearance` | Table 232-1 clearance values (TSV). Columns: `description`, `col1`–`col4` |
| `dt_nesc_loading_zones` | NESC loading district boundaries. Field: `zonename` |
| `dt_or_railroads` | Oregon railroad geometries. Used for `geo_intersect` / `geo_query` |
| `dt_oregon_public_roads` | Oregon public road geometries. Used for `geo_query` with 5 m buffer |

## Sync & Compile

```bash
dim sync --module nesc --path . --types nesc~GroundClearanceBayPoints nesc~GroundClearanceCalculator nesc~GroundClearanceProcessing SpanStack nesc~PoleLoadingSpanCheckManager
dim analyze --module nesc 2>&1 | python3 scripts/dim_analyze_filter.py
```
