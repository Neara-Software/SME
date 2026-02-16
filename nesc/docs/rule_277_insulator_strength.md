# NESC Rule 277 — Mechanical Strength of Insulators

## Standard Reference

NESC Rule 277 requires that insulators withstand loads from Rules 250B, 250C, and 250D without exceeding the percentages of their rated strength specified in Table 277-1. Unlike the structural checks in Rules 250B/C/D, Rule 277 does **not** apply Rule 253 strength/load factors — the Table 277-1 percentages themselves provide the required safety margin.

This means Rule 277 runs its own FEA simulations using separate environment templates that have `load_factor = 1.0`.

## Table 277-1 — Allowed Percentages

| FEA Report Type | Component Type | Check | Allowed % |
|---|---|---|---|
| StiffInsulatorReport | `post` | Moment (cantilever) | 40% |
| StiffInsulatorReport | `post` | Force (tension/compression) | 50% |
| StiffInsulatorReport | `pin` | Moment (cantilever) | 40% |
| StiffInsulatorReport | `pin` | Force | 40% |
| CableInsulatorReport | `susp` / `strn` | Tension (combined M&E) | 50% |

The same percentages apply for all three load cases (250B, 250C, 250D).

### Pass/Fail Criterion

```
rule_277_ratio = fea_utilisation / allowed_percentage
```

If `rule_277_ratio > 1.0`, the insulator **fails**.

## Architecture

### Dependency Chain

```
Rule 243 (grade of construction: "B" or "C")
    |
    v
Rules 250B/C/D (define environments + structural checks)
    |
    v
Rule 277 (insulator checks using same weather, load_factor=1.0)
```

### Why Separate Simulations?

`make_environment()` does not accept a `load_factor` override. The 250B/C/D environments have load factors set per Rule 253 (e.g., 1.50 for Grade C transverse wind). Rule 277 needs `load_factor = 1.0` because Table 277-1 already accounts for safety margin. Therefore, separate environment templates prefixed `277_` must be pre-created in the Neara model.

### File Structure

```
nesc/Types/
  nesc~PoleLoadingRule277Calculator.neara.hjson   Calculator (4 fields)
  nesc~PoleLoadingRule277Processing.neara.hjson    Processing (31 fields)
  nesc~PoleLoadingCheckManager.neara.hjson         Manager (modified — added rule_277_output)
```

## Calculator — `nesc~PoleLoadingRule277Calculator`

Token: `nesc~ct_PoleLoadingRule277Calculator`

Simple wrapper that delegates to Processing and shapes the output.

| Field | Type | Description |
|---|---|---|
| `model_input` | `type_only` | Injected `PoleLoadingModelInput` |
| `rule_243_output` | `type_only` | Injected grade of construction from Rule 243 |
| `processing` | `make_immutable_record` | Instantiates `PoleLoadingRule277Processing` |
| `output` | record | Final output (see Output Structure below) |

### Output Structure

```
{
  worst_stiff_insulator: { rule, component_type, check_type, fea_utilisation, allowed_percentage, rule_277_ratio, report, simulation }
  worst_cable_insulator: { rule, component_type, check_type, fea_utilisation, allowed_percentage, rule_277_ratio, report, simulation }
  worst_ratio: <max of the two ratios>
  pass: <worst_ratio <= 1.0>
}
```

## Processing — `nesc~PoleLoadingRule277Processing`

Token: `nesc~ct_PoleLoadingRule277Processing`

Contains all computation logic. Fields are listed alphabetically per project convention.

### Inputs

| Field | Description |
|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` — pole geometry, spans, etc. |
| `rule_243_output` | `type_only` — grade of construction ("B" or "C") |

### Loading District Classification

Same logic as Rule 250B Processing. Uses geo-queries against `dt_nesc_loading_zones`.

| Field | Description |
|---|---|
| `pole_check` | `geo_query(model().dt_nesc_loading_zones, pole.geometry, 0ft)[].zonename` |
| `strain_section_check` | `geo_query(model().dt_nesc_loading_zones, pole.spans[].section[].geometry, 0ft)[].zonename` |
| `is_heavy` | True if pole or any strain section is in Heavy Loading District |
| `is_medium` | True if not heavy and pole is in Medium Loading District |
| `is_light` | True if not heavy/medium and pole is in Light Loading District |

### Applicability Checks (250C/D only)

| Field | Description |
|---|---|
| `nesc250c_required` | `pole.height > 6ft` or any `span.ground_clearance > 60ft` |
| `nesc250d_required` | Same criteria as 250C |

### Weather Data (geo-queries)

| Field | DataTable | Description |
|---|---|---|
| `nesc250c_wind` | `dt_250c_grc_wind_speed` or `dt_250c_grb_wind_speed` | Wind speed (mph) — grade-dependent |
| `nesc_250d_wind` | `dt_250d_wind` | Wind speed (mph) for extreme ice+wind |
| `nesc_250d_ice` | `dt_250d_ice` | Ice radial thickness (inches) |

### Environment Selection

Each environment uses a separate template with `load_factor = 1.0`:

| Field | Template Labels | Notes |
|---|---|---|
| `env_250b` | `277_250B_{Hvy\|Med\|Lgt} {B\|C}` | Selected by loading district + grade; 6 possible templates |
| `env_250c` | `277_250C C` | Uses `make_environment(template:, wind_pressure:)` with calculated wind pressure. Guarded by `nesc250c_required` and null checks. |
| `env_250d` | `277_250D C` | Uses `make_environment(template:, wind_pressure:, ice_radial_thickness:)`. Guarded by `nesc250d_required` and null checks on wind+ice data. |

Wind pressure formula (ASCE 7): `0.00256 * V^2` in psf, where V = wind speed in mph.

### FEA Simulations

| Field | Description |
|---|---|
| `simulations_250b` | `simulate_structure_fea(primary_pole, environment: env_250b, wind_dirs: 8, network_solve: false)` — null-guarded |
| `simulations_250c` | Same pattern with `env_250c` — null-guarded |
| `simulations_250d` | Same pattern with `env_250d` — null-guarded |

All simulations use 8 wind directions and `network_solve: false` (single-pole analysis).

### Table 277-1 Percentage Lambdas

| Field | Signature | Logic |
|---|---|---|
| `allowed_pct_stiff` | `lambda(component_type, check_type)` | Returns 0.50 for post+Force, 0.40 for everything else |
| `allowed_pct_cable` | `lambda(component_type)` | Always returns 0.50 |

### Extraction Lambdas

#### `extract_worst_stiff(sims, rule_name)`

Finds the worst stiff insulator across all simulations for a given rule:

1. Collects all `StiffInsulatorReports` from the simulation results
2. Finds worst moment utilization across all reports (any component type)
3. Splits reports into `post` and `pin` by `component_type`
4. Finds worst force utilization for each
5. Computes `rule_277_ratio` for each:
   - `moment_ratio = moment_util / 0.40`
   - `post_force_ratio = post_force_util / 0.50`
   - `pin_force_ratio = pin_force_util / 0.40`
6. Returns the result with the highest ratio

#### `extract_worst_cable(sims, rule_name)`

Finds the worst cable insulator:

1. Collects all `CableInsulatorReports` from simulation results
2. Finds worst tension utilization via `max_by`
3. Computes `rule_277_ratio = tension_util / 0.50`
4. Returns result record or null if no reports exist

### Result Record Shape

Both extraction lambdas return records with the same fields:

```
{
  rule:               "250B" | "250C" | "250D"
  component_type:     "post" | "pin" | "susp" | "strn"
  check_type:         "Moment" | "Force" | "Tension"
  fea_utilisation:    raw FEA utilization (0.0–1.0+)
  allowed_percentage: Table 277-1 allowed % (0.40 or 0.50)
  rule_277_ratio:     fea_utilisation / allowed_percentage
  report:             full FEA report object
  simulation:         matched simulation (by solve ID)
}
```

### Aggregation

| Field | Description |
|---|---|
| `stiff_250b/c/d` | Calls `extract_worst_stiff` for each simulation set |
| `cable_250b/c/d` | Calls `extract_worst_cable` for each simulation set |
| `worst_stiff_insulator` | Highest `rule_277_ratio` across `stiff_250b/c/d` (null-safe) |
| `worst_cable_insulator` | Highest `rule_277_ratio` across `cable_250b/c/d` (null-safe) |
| `worst_ratio` | `max(worst_stiff.rule_277_ratio, worst_cable.rule_277_ratio)` |

## CheckManager Integration

In `nesc~PoleLoadingCheckManager`, Rule 277 is wired identically to Rules 250B/C/D:

```
rule_277_output:
  make_immutable_record(
    "nesc~PoleLoadingRule277Calculator",
    model_input: nesc_pla_model_input,
    rule_243_output: rule_243_output,
  ).output
```

## Required Model Configuration

The following environment templates must be created in the Neara model with `load_factor = 1.0`. They should mirror the corresponding 250B/C/D templates in every respect except load factor.

### 250B Templates (6 total)

| Label | Loading District | Grade |
|---|---|---|
| `277_250B_Hvy B` | Heavy | B |
| `277_250B_Hvy C` | Heavy | C |
| `277_250B_Med B` | Medium | B |
| `277_250B_Med C` | Medium | C |
| `277_250B_Lgt B` | Light | B |
| `277_250B_Lgt C` | Light | C |

### 250C Template (1)

| Label | Notes |
|---|---|
| `277_250C C` | Wind pressure is overridden at runtime via `make_environment(template:, wind_pressure:)` |

### 250D Template (1)

| Label | Notes |
|---|---|
| `277_250D C` | Wind pressure and ice thickness are overridden at runtime via `make_environment(template:, wind_pressure:, ice_radial_thickness:)` |

## FEA Report Field Paths

All FEA property names use lowercase (platform convention):

| Report Type | Path | Description |
|---|---|---|
| `StiffInsulatorReports` | `.worst[].moment[].utilization` | Cantilever moment utilization |
| `StiffInsulatorReports` | `.worst[].force[].utilization` | Tension/compression force utilization |
| `StiffInsulatorReports` | `.component_type` | `"post"` or `"pin"` |
| `CableInsulatorReports` | `.worst[].tension[].utilization` | Combined M&E tension utilization |
| `CableInsulatorReports` | `.component_type` | `"susp"` or `"strn"` |

## Sync & Compile

```bash
dim sync --module nesc --path . --types nesc~PoleLoadingRule277Calculator nesc~PoleLoadingRule277Processing nesc~PoleLoadingCheckManager
dim analyze --module nesc 2>&1 | python3 scripts/dim_analyze_filter.py
```
