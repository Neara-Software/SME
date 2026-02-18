# NESC Rule 277 — Mechanical Strength of Insulators

## Standard Reference

NESC Rule 277 requires that insulators withstand loads from Rules 250B, 250C, and 250D without exceeding the percentages of their rated strength specified in Table 277-1. Unlike the structural checks in Rules 250B/C/D, Rule 277 does **not** apply Rule 253 strength/load factors — the Table 277-1 percentages themselves provide the required safety margin.

This means Rule 277 runs its own FEA simulations using separate environment templates that have `load_factor = 1.0`.

## Table 277-1 — Allowed Percentages

Stored in the data table `nesc~277-1 allowed percentage` with columns: `insulator_type`, `check_type`, `allowed_percentage`.

| Insulator Type | Check Type | Allowed % |
|---|---|---|
| `post` | Moment | 40% |
| `post` | Force | 50% |
| `pin` | Moment | 40% |
| `pin` | Force | 40% |
| `cable` | Tension | 50% |

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

Rule 277 receives **pre-computed outputs** from Rules 250B, 250C, and 250D via dependency injection. It does **not** perform its own geo-queries or loading district classification — those are handled upstream by the respective 250x calculators.

### Why Separate Simulations?

`make_environment()` does not accept a `load_factor` override. The 250B/C/D environments have load factors set per Rule 253 (e.g., 1.50 for Grade C transverse wind). Rule 277 needs `load_factor = 1.0` because Table 277-1 already accounts for safety margin. Therefore, separate environment templates prefixed `277_` must be pre-created in the Neara model.

### File Structure

```
nesc/Types/
  nesc~PoleLoadingRule277Calculator.neara.hjson   Calculator (8 fields)
  nesc~PoleLoadingRule277Processing.neara.hjson    Processing (20 fields)
  nesc~PoleLoadingCheckManager.neara.hjson         Manager (wires rule_277_output)
nesc/DataTables/
  nesc~277-1 allowed percentage.neara.hjson        Table 277-1 lookup
```

## Calculator — `nesc~PoleLoadingRule277Calculator`

Token: `nesc~ct_PoleLoadingRule277Calculator`

Wrapper that looks up Table 277-1 percentages, injects them into Processing via DI, and shapes the output.

| Field | Type | Description |
|---|---|---|
| `get_allowed_percentage` | lambda | Looks up `allowed_percentage` from data table by `insulator_type` + `check_type` |
| `model_input` | `type_only` | Injected `PoleLoadingModelInput` |
| `output` | record | Final output (see Output Structure below) |
| `processing` | `make_immutable_record` | Instantiates Processing with all DI values |
| `rule_243_output` | `type_only` | Injected grade of construction from Rule 243 |
| `rule_250b_output` | `type_only` | Injected output from Rule 250B calculator |
| `rule_250c_output` | `type_only` | Injected output from Rule 250C calculator |
| `rule_250d_output` | `type_only` | Injected output from Rule 250D calculator |

### Data Table Lookup

The `get_allowed_percentage` lambda queries the `nesc~277-1 allowed percentage` data table:

```
lambda(
  insulator_type: type_only("AA"&""),
  check_type: type_only("AA"&""),
  let(
    row: find(
      model().dt_277_1_allowed_percentage,
      and(
        model().dt_277_1_allowed_percentage[].insulator_type = insulator_type,
        model().dt_277_1_allowed_percentage[].check_type = check_type,
      ),
    ),
    row.allowed_percentage,
  ),
)
```

Each lookup is wrapped in `not_null()` when injected into Processing to catch missing data table rows early:

```
pct_cable_tension: not_null(call(get_allowed_percentage, insulator_type: "cable", check_type: "Tension")),
pct_stiff_moment: not_null(call(get_allowed_percentage, insulator_type: "post", check_type: "Moment")),
pct_stiff_post_force: not_null(call(get_allowed_percentage, insulator_type: "post", check_type: "Force")),
pct_stiff_pin_force: not_null(call(get_allowed_percentage, insulator_type: "pin", check_type: "Force")),
```

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

### Injected Inputs

| Field | Source | Description |
|---|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` | Pole geometry, spans, etc. |
| `rule_243_output` | `type_only` | Grade of construction ("B" or "C") |
| `rule_250b_output` | `type_only` | Output from Rule 250B (loading district, etc.) |
| `rule_250c_output` | `type_only` | Output from Rule 250C (wind speed); nullable |
| `rule_250d_output` | `type_only` | Output from Rule 250D (wind speed, ice thickness); nullable |
| `pct_cable_tension` | `type_only(0.01)` | Injected: cable tension allowed % (0.50) |
| `pct_stiff_moment` | `type_only(0.01)` | Injected: stiff moment allowed % (0.40) |
| `pct_stiff_pin_force` | `type_only(0.01)` | Injected: pin force allowed % (0.40) |
| `pct_stiff_post_force` | `type_only(0.01)` | Injected: post force allowed % (0.50) |

The `pct_*` fields use `type_only(0.01)` (not `0`) as a sentinel to avoid division-by-zero if DI somehow fails to inject. In normal operation, the Calculator always injects the real values.

### Environment Selection

Each environment uses a separate template with `load_factor = 1.0`:

| Field | Template Labels | Notes |
|---|---|---|
| `env_250b` | `277_250B_{Hvy\|Med\|Lgt} {B\|C}` | Selected by `rule_250b_output.loading_district` + `rule_243_output.grade_of_construction`; 6 possible templates |
| `env_250c` | `277_250C C` | Uses `make_environment(template:, wind_pressure:)` with wind pressure from `rule_250c_output.wind_speed`. Guarded by `rule_250c_output <> null`. |
| `env_250d` | `277_250D C` | Uses `make_environment(template:, wind_pressure:, ice_radial_thickness:)` with values from `rule_250d_output`. Guarded by `rule_250d_output <> null`. |

Wind pressure formula (ASCE 7): `0.00256 * V^2` in psf, where V = wind speed in mph.

### FEA Simulations

| Field | Description |
|---|---|
| `simulations_250b` | `simulate_structure_fea(primary_pole, environment: env_250b, wind_dirs: 8, network_solve: false)` — null-guarded on `env_250b` |
| `simulations_250c` | Same pattern with `env_250c` |
| `simulations_250d` | Same pattern with `env_250d` |

All simulations use 8 wind directions and `network_solve: false` (single-pole analysis).

### Extraction Lambdas

Both lambdas use typed parameters for proper field path resolution:

```
sims: type_only(model().FeaReports[].PoleReports)
```

**Important**: Because the `sims` parameter is typed (not `type_only(null)`), all call sites must use the null-stripping pattern:

```
if(
  simulations_250b <> null,
  call(extract_worst_cable, sims: not_null(simulations_250b), rule_name: "250B"),
)
```

#### `extract_worst_cable(sims, rule_name)`

Finds the worst cable insulator across all simulations for a given rule:

1. Collects all `CableInsulatorReports` from `sims[].CableInsulatorReports`
2. Finds worst tension utilization via `max_by(reports, reports[].worst[].tension[].utilization)`
3. Computes `rule_277_ratio = tension_util / pct_cable_tension`
4. Returns result record or null if no reports exist

Uses nested `let()` (dim requires one binding per level):

```
let(
  reports: sims[].CableInsulatorReports,
  let(
    worst: max_by(reports, reports[].worst[].tension[].utilization),
    ...
  ),
)
```

#### `extract_worst_stiff(sims, rule_name)`

Finds the worst stiff insulator across all simulations for a given rule:

1. Collects all `StiffInsulatorReports` from `sims[].StiffInsulatorReports`
2. Finds worst moment utilization across all reports (any component type)
3. Splits reports into `post` and `pin` by `cable_attachment.type.component_type` (see FEA paths below)
4. Finds worst force utilization for each
5. Computes `rule_277_ratio` for each using injected percentages:
   - `moment_ratio = moment_util / pct_stiff_moment`
   - `post_force_ratio = post_force_util / pct_stiff_post_force`
   - `pin_force_ratio = pin_force_util / pct_stiff_pin_force`
6. Returns the result with the highest ratio

### Result Record Shape

Both extraction lambdas return records with the same fields:

```
{
  rule:               "250B" | "250C" | "250D"
  component_type:     "post" | "pin" | cable attachment type
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
| `cable_250b/c/d` | Calls `extract_worst_cable` for each simulation set (null-guarded) |
| `stiff_250b/c/d` | Calls `extract_worst_stiff` for each simulation set (null-guarded) |
| `worst_cable_insulator` | Highest `rule_277_ratio` across `cable_250b/c/d` (null-safe) |
| `worst_stiff_insulator` | Highest `rule_277_ratio` across `stiff_250b/c/d` (null-safe) |
| `worst_ratio` | `max(worst_stiff.rule_277_ratio, worst_cable.rule_277_ratio)` |

## CheckManager Integration

In `nesc~PoleLoadingCheckManager`, Rule 277 receives outputs from all upstream rules:

```
rule_277_output:
  make_immutable_record(
    "nesc~PoleLoadingRule277Calculator",
    model_input: nesc_pla_model_input,
    rule_243_output: rule_243_output,
    rule_250b_output: rule_250b_output,
    rule_250c_output: rule_250c_output,
    rule_250d_output: rule_250d_output,
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

All FEA property names use lowercase (platform convention). Insulator reports access `component_type` through the `cable_attachment.type` path — there is **no** top-level `component_type` on insulator reports.

| Report Type | Path | Description |
|---|---|---|
| `CableInsulatorReports` | `.worst[].tension[].utilization` | Combined M&E tension utilization |
| `CableInsulatorReports` | `.cable_attachment.type.component_type` | Cable insulator type |
| `StiffInsulatorReports` | `.worst[].moment[].utilization` | Cantilever moment utilization |
| `StiffInsulatorReports` | `.worst[].force[].utilization` | Tension/compression force utilization |
| `StiffInsulatorReports` | `.cable_attachment.type.component_type` | `"post"` or `"pin"` |

When used in array context (e.g., `filter`), the path becomes:

```
reports[].cable_attachment[].type[].component_type
```

## Key Dim Patterns Used

### Typed lambda parameters
Lambda `sims` parameter uses `type_only(model().FeaReports[].PoleReports)` instead of `type_only(null)` so the platform can resolve field paths like `.CableInsulatorReports` within the lambda body.

### Null-stripping for typed parameters
Because the lambda param is typed, passing a nullable value directly causes a type error. Use `if(x <> null, call(fn, arg: not_null(x)))` to check outside and strip nullability inside.

### not_null() on data table lookups
Wrap `find()` results from data table queries with `not_null()` to fail early with a clear message if a row is missing.

### type_only(0.01) sentinel
Percentage fields use `type_only(0.01)` not `type_only(0)` to prevent division-by-zero if DI injection somehow doesn't occur.

### Nested let() bindings
Dim's `let()` binds one name-value pair per level. Multiple sequential bindings require nesting.

## Sync & Compile

```bash
dim sync --module nesc --path . --types nesc~PoleLoadingRule277Calculator nesc~PoleLoadingRule277Processing nesc~PoleLoadingCheckManager
dim analyze --module nesc 2>&1 | python3 scripts/dim_analyze_filter.py
```
