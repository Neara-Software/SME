# portland_nesc — Portland General Electric NESC Overrides

## Overview

The `portland_nesc` module extends the base `nesc` module with Portland General Electric (PGE) customer-specific requirements from two design standards:

- **LD20055** — Grades of Construction, Load Factors, and Strength Factors
- **LD20020** — General Loading Requirements for Overhead Lines

PGE rules always apply — there is no toggle. The module follows the same customer-overlay architecture as `pacific` extends `go95`.

### Key PGE Deviations from Base NESC

| Area | Base NESC | PGE Override |
|---|---|---|
| Rule 243 — Grade B criteria | Transmission, railroad, freeway, waterway | Adds: 4-lane highway >= 55 mph |
| Rule 250C — Applicability | Structures/spans > 60 ft only | **All structures** regardless of height |
| Rule 250C — Wind speed | Grade-dependent (B or C) | Always uses **Grade B** (85 mph) |
| Rule 250C/D — Load factors | Single set of factors | **Steel vs wood/FRP split** (different load + strength factors) |
| Rule 250B — Guy checks | Same grade as structure | **Always Grade B** regardless of structure grade |
| Extreme ice | Not in base NESC | **PGE-specific** — 0.5"/1.0" ice, no wind |
| Fire wind | Not in base NESC | **PGE-specific** — 85/110 mph in HFRZs |

---

## Architecture

### Dependency Chain

```
portland_nesc~PoleLoadingCheckManager
    |
    |-- rule_242_output        (base nesc — unchanged)
    |-- rule_243_output        (portland_nesc~PoleLoadingRule243Calculator)
    |       |
    |       +-- portland_nesc~PoleLoadingRule243Processing
    |               (adds is_major_highway)
    |
    |-- rule_250b_output       (base nesc calculator, PGE processing injected via DI)
    |       |
    |       +-- portland_nesc~PoleLoadingRule250bProcessing
    |               (adds environment_grade_b, simulations_grade_b for guys)
    |
    |-- rule_250c_output       (base nesc calculator, PGE processing injected via DI)
    |       |
    |       +-- portland_nesc~PoleLoadingRule250cProcessing
    |               (all heights, Grade B wind, steel/wood split)
    |
    |-- rule_250d_output       (base nesc — unchanged, PGE factors in env templates)
    |
    |-- rule_277_output        (base nesc — unchanged)
    |
    |-- extreme_ice_output     (PGE-only)
    |       |
    |       +-- portland_nesc~PoleLoadingExtremeIceCalculator
    |               +-- portland_nesc~PoleLoadingExtremeIceProcessing
    |
    +-- fire_wind_output       (PGE-only)
            |
            +-- portland_nesc~PoleLoadingFireWindCalculator
                    +-- portland_nesc~PoleLoadingFireWindProcessing
```

### Override Strategy

The module uses two override patterns:

1. **Dependency Injection (DI):** For 250B and 250C, the PGE Processing type is instantiated and injected into the base NESC Calculator via the `processing` parameter of `make_immutable_record`. The base Calculator's `output` formula reads from `processing.max_pole`, `processing.max_stay`, etc., so the PGE Processing seamlessly replaces the base Processing without duplicating the Calculator.

2. **Full replacement:** For Rule 243, the PGE Calculator replaces the base Calculator entirely because the `get_grade_of_construction` lambda has additional parameters (`is_major_highway`).

3. **New types:** Extreme ice and fire wind are PGE-only checks with their own Calculator/Processing pairs, following the same structural pattern as base NESC rules.

---

## File Structure

```
portland_nesc/
├── module.neara.hjson
├── docs/
│   ├── portland_nesc_module.md               (this file)
│   ├── LD20055_grades_load_strength_factors.md
│   └── LD20020_general_loading_requirements.md
├── Types/
│   ├── portland_nesc~PoleLoadingCheckManager.neara.hjson
│   ├── portland_nesc~PoleLoadingRule243Calculator.neara.hjson
│   ├── portland_nesc~PoleLoadingRule243Processing.neara.hjson
│   ├── portland_nesc~PoleLoadingRule250bProcessing.neara.hjson
│   ├── portland_nesc~PoleLoadingRule250cProcessing.neara.hjson
│   ├── portland_nesc~PoleLoadingExtremeIceCalculator.neara.hjson
│   ├── portland_nesc~PoleLoadingExtremeIceProcessing.neara.hjson
│   ├── portland_nesc~PoleLoadingFireWindCalculator.neara.hjson
│   └── portland_nesc~PoleLoadingFireWindProcessing.neara.hjson
└── DataTables/
    ├── portland_nesc~extreme_ice_loading.neara.hjson
    └── portland_nesc~fire_wind_speed.neara.hjson
```

---

## CheckManager — `portland_nesc~PoleLoadingCheckManager`

Token: `portland_nesc~ct_PoleLoadingCheckManager`

Orchestrates all PGE checks. Takes a `pole` input (type_only `~Pole`) and produces outputs for every rule.

| Field | Source | Description |
|---|---|---|
| `pole` | `type_only("~Pole")` | Injected pole |
| `nesc_pla_model_input` | `make_immutable_record("nesc~PoleLoadingModelInput", pole: pole)` | Shared model input for all rules |
| `rule_242_output` | Base `nesc~PoleLoadingRule242Calculator` | Grade of construction per conductor crossings — unchanged |
| `rule_243_output` | **PGE** `portland_nesc~PoleLoadingRule243Calculator` | Grade of construction per pole — adds major highway |
| `rule_250b_output` | Base calculator + **PGE** `portland_nesc~PoleLoadingRule250bProcessing` injected | Combined ice+wind — guys always Grade B |
| `rule_250c_output` | Base calculator + **PGE** `portland_nesc~PoleLoadingRule250cProcessing` injected | Extreme wind — all heights, Grade B wind, steel/wood |
| `rule_250d_output` | Base `nesc~PoleLoadingRule250dCalculator` | Extreme ice+wind — unchanged (PGE factors in env templates) |
| `rule_277_output` | Base `nesc~PoleLoadingRule277Calculator` | Insulator strength — unchanged |
| `extreme_ice_output` | **PGE** `portland_nesc~PoleLoadingExtremeIceCalculator` | PGE-only extreme ice (no wind) |
| `fire_wind_output` | **PGE** `portland_nesc~PoleLoadingFireWindCalculator` | PGE-only fire wind in HFRZs |

---

## Rule 243 — Grade of Construction Override

### Calculator — `portland_nesc~PoleLoadingRule243Calculator`

Token: `portland_nesc~ct_PoleLoadingRule243Calculator`

Extends base NESC Rule 243 by adding PGE-specific Grade B criteria.

**`get_grade_of_construction` lambda:**

```
lambda(
  is_freeway_crossing, is_major_highway, is_rail_crossing,
  is_transmission, is_water_crossing,
  → if any are true: "B", else: "C"
)
```

| Parameter | Source | Description |
|---|---|---|
| `is_freeway_crossing` | `geo_intersect` vs `dt_esri_freewaysystem` | Base NESC — limited-access highway |
| `is_major_highway` | `geo_intersect` vs `dt_esri_freewaysystem` (proxy) | **PGE LD20055** — 4-lane highway >= 55 mph |
| `is_rail_crossing` | `geo_intersect` vs `dt_or_railroads` | Base NESC — railroad |
| `is_transmission` | `max(voltage) >= 57kV` | Base NESC — transmission line |
| `is_water_crossing` | `geo_intersect` vs `dt_nhd_waterbody` | Base NESC — navigable waterway |

**Note:** `is_major_highway` currently uses `dt_esri_freewaysystem` as a proxy. When a dedicated PGE major highway data table becomes available, update `portland_nesc~PoleLoadingRule243Processing.is_major_highway` to reference the new table.

### Processing — `portland_nesc~PoleLoadingRule243Processing`

Token: `portland_nesc~ct_PoleLoadingRule243Processing`

Duplicates the base processing fields and adds `is_major_highway`.

### Output Structure

```
{
  grade_of_construction: "B" | "C"
}
```

---

## Rule 250B — Combined Ice and Wind Override

### Processing — `portland_nesc~PoleLoadingRule250bProcessing`

Token: `portland_nesc~ct_PoleLoadingRule250bProcessing`

Extends the base 250B Processing with two new fields to implement LD20055 Table 5: "Guys always Grade B."

| Field | Description |
|---|---|
| `environment` | Standard 250B environment selection by loading district + grade (same as base) |
| `environment_grade_b` | **PGE** — Always the Grade B environment for the current loading district |
| `simulations` | Standard FEA with the grade-appropriate environment |
| `simulations_grade_b` | **PGE** — Additional FEA with Grade B environment, runs only when grade = "C" |
| `max_pole` | Worst pole utilization from `simulations` (same as base) |
| `max_xarm` | Worst crossarm utilization from `simulations` (same as base) |
| `max_stay` | **PGE** — Worst stay utilization from `simulations_grade_b` when available, else `simulations` |

**Logic:** When the pole is Grade C, the Processing runs two simulations:
1. Grade C simulation → used for `max_pole` and `max_xarm`
2. Grade B simulation → used for `max_stay` (guys checked at Grade B)

When the pole is Grade B, only one simulation runs and all components use it.

---

## Rule 250C — Extreme Wind Override

### Processing — `portland_nesc~PoleLoadingRule250cProcessing`

Token: `portland_nesc~ct_PoleLoadingRule250cProcessing`

Three overrides from base 250C:

| Field | Base NESC | PGE Override |
|---|---|---|
| `nesc250c_required` | `pole.height > 6ft` or `span.ground_clearance > 60ft` | **`true`** — applies to all structures |
| `nesc250c_wind` | Grade-dependent wind speed map (`dt_250c_grc_wind_speed` for C, `dt_250c_grb_wind_speed` for B) | Always `dt_250c_grb_wind_speed` (Grade B = 85 mph) |
| `environment` | Single template `"250C C"` | **Steel/wood split:** `"PGE_250C_Steel"` or `"PGE_250C_Wood"` based on `is_steel_pole` |

### Steel/Wood Detection

```
is_steel_pole: model_input.pole.type.material = "steel"
```

Used in 250C, extreme ice, and fire wind to select the correct environment template with the appropriate load/strength factors per LD20055.

---

## Extreme Ice — PGE-Specific

### Calculator — `portland_nesc~PoleLoadingExtremeIceCalculator`

Token: `portland_nesc~ct_PoleLoadingExtremeIceCalculator`

Thin wrapper that delegates to Processing and shapes output.

### Processing — `portland_nesc~PoleLoadingExtremeIceProcessing`

Token: `portland_nesc~ct_PoleLoadingExtremeIceProcessing`

Implements LD20055 Table 4 extreme ice (no concurrent wind). This loading condition does not exist in base NESC.

| Field | Description |
|---|---|
| `extreme_ice_required` | `true` if pole is in heavy or medium loading district |
| `ice_params` | Lookup from `portland_nesc~dt_extreme_ice_loading` by loading district |
| `is_steel_pole` | `model_input.pole.type.material = "steel"` |
| `environment` | Template selected by material + district, ice thickness overridden at runtime |
| `simulations` | Standard FEA with 8 wind directions |
| `max_pole` / `max_stay` / `max_xarm` | Standard worst-case extraction |

### Environment Template Selection

| Pole Material | District | Template |
|---|---|---|
| Wood/FRP | Medium | `PGE_ExtremeIce_Wood_Med` |
| Wood/FRP | Heavy | `PGE_ExtremeIce_Wood_Hvy` |
| Steel | Medium | `PGE_ExtremeIce_Steel_Med` |
| Steel | Heavy | `PGE_ExtremeIce_Steel_Hvy` |

### Output Structure

```
{
  environment: <environment record>,
  worst_pole: { check_type, beamreport, simulation, utilisation },
  worst_stay: { stay, check_type, stayreport, simulation, utilisation } | null,
  worst_xarm: { check_type, beamreport, simulation, utilisation },
}
```

Returns `null` if `extreme_ice_required` is false.

---

## Fire Wind — PGE-Specific

### Calculator — `portland_nesc~PoleLoadingFireWindCalculator`

Token: `portland_nesc~ct_PoleLoadingFireWindCalculator`

Thin wrapper that delegates to Processing and shapes output.

### Processing — `portland_nesc~PoleLoadingFireWindProcessing`

Token: `portland_nesc~ct_PoleLoadingFireWindProcessing`

Implements LD20055 Table 4 fire wind loading. Applies to poles in PGE High Fire Risk Zones (HFRZs).

| Field | Description |
|---|---|
| `fire_wind_required` | `geo_query` against `dt_pge_hfrz` — true if pole is in a HFRZ |
| `is_transmission` | `max(voltage) >= 57kV` |
| `is_steel_pole` | `model_input.pole.type.material = "steel"` |
| `fire_wind_pressure` | Distribution: `0.00256 * 85^2 = 18.5 psf`; Transmission: `0.00256 * 110^2 = 31.0 psf` |
| `environment` | `"PGE_FireWind_Steel"` or `"PGE_FireWind_Wood"` with wind pressure overridden |
| `simulations` | Standard FEA with 8 wind directions |
| `max_pole` / `max_stay` / `max_xarm` | Standard worst-case extraction |

### Output Structure

Same shape as extreme ice output. Returns `null` if `fire_wind_required` is false (pole not in HFRZ).

---

## Data Tables

### `portland_nesc~extreme_ice_loading`

Extreme ice parameters by NESC loading district.

| loading_district | temperature_f | ice_thickness_in | wind_pressure_psf |
|---|---|---|---|
| Medium | 32 | 0.5 | 0 |
| Heavy | 32 | 1.0 | 0 |

### `portland_nesc~fire_wind_speed`

Fire wind speed by voltage class.

| voltage_class | voltage_lower_kv | wind_speed_mph | wind_pressure_psf |
|---|---|---|---|
| Distribution | 0 | 85 | 18.5 |
| Transmission | 57 | 110 | 31.0 |

---

## Required Environment Templates

The following environment templates must be created in the Neara model before the module will function. Load and strength factors are defined by LD20055.

### 250C Extreme Wind (LD20055 Table 2)

| Label | Material | Load Factors (all) | Strength Factor |
|---|---|---|---|
| `PGE_250C_Wood` | Wood/FRP | 1.0 | Wood=0.75, FRP=1.0 |
| `PGE_250C_Steel` | Steel | 1.1 | Steel=1.0 |

Wind pressure overridden at runtime via `make_environment(template:, wind_pressure:)`.

### 250D Extreme Ice + Wind (LD20055 Table 3)

| Label | Material | Load Factors (all) | Strength Factor |
|---|---|---|---|
| `PGE_250D_Wood` | Wood/FRP | 1.0 | Wood=0.75, FRP=1.0 |
| `PGE_250D_Steel` | Steel | 1.1 | Steel=1.0 |

Wind pressure and ice overridden at runtime.

### Extreme Ice — No Wind (LD20055 Table 4)

| Label | Material / District | Load Factors | Strength Factor |
|---|---|---|---|
| `PGE_ExtremeIce_Wood_Med` | Wood, Medium | wind=1.1, vert=1.1, long=1.0/1.1 | Wood=0.75, FRP=0.75 |
| `PGE_ExtremeIce_Wood_Hvy` | Wood, Heavy | same | same |
| `PGE_ExtremeIce_Steel_Med` | Steel, Medium | all=1.1 | Steel=1.0 |
| `PGE_ExtremeIce_Steel_Hvy` | Steel, Heavy | same | same |

Ice thickness overridden at runtime (Medium=0.5", Heavy=1.0").

### Fire Wind (LD20055 Table 4)

| Label | Material | Load Factors (all) | Strength Factor |
|---|---|---|---|
| `PGE_FireWind_Wood` | Wood/FRP | 1.1 | Wood=0.75 |
| `PGE_FireWind_Steel` | Steel | 1.1 | Steel=1.0 |

Wind pressure overridden at runtime (85 mph=18.5 psf or 110 mph=31.0 psf).

---

## Required Geospatial Data Tables

| Data Table | Status | Description |
|---|---|---|
| `dt_nesc_loading_zones` | Existing | NESC loading district boundaries |
| `dt_esri_freewaysystem` | Existing | Limited-access highway geometries |
| `dt_or_railroads` | Existing | Railroad geometries |
| `dt_nhd_waterbody` | Existing | Navigable waterway geometries |
| `dt_250c_grb_wind_speed` | Existing | 250C Grade B wind speed map |
| `dt_250d_ice` | Existing | 250D ice thickness map |
| `dt_250d_wind` | Existing | 250D concurrent wind speed map |
| `dt_pge_hfrz` | **Needed** | PGE High Fire Risk Zone boundaries |

**Note:** If `dt_pge_hfrz` is not loaded, `fire_wind_required` returns false and fire wind checks are skipped gracefully.

---

## FEA Report Field Paths

All processing types extract worst-case results using the same patterns:

| Component | Report Type | Metric | Path |
|---|---|---|---|
| Pole | `BeamReports` (filtered: `is_on_pole`) | Stress | `.worst[].normal_stress[].utilization` |
| Pole | `BeamReports` (filtered: `is_on_pole`) | Moment | `.worst[].moment[].utilization` |
| Crossarm | `BeamReports` (filtered: `not(is_on_pole)`) | Stress | `.worst[].normal_stress[].utilization` |
| Crossarm | `BeamReports` (filtered: `not(is_on_pole)`) | Moment | `.worst[].moment[].utilization` |
| Stay/Guy | `StayCableReports` | Tension | `.worst[].tension[].utilization` |

The higher of stress and moment utilization is reported for poles and crossarms. Stays only report tension.

---

## Future Enhancements

1. **Major highway data table** — Replace `dt_esri_freewaysystem` proxy in `is_major_highway` with a dedicated PGE data table that identifies 4-lane highways with speed >= 55 mph.
2. **250D steel/wood split** — Create PGE-specific 250D Processing to select `PGE_250D_Wood` / `PGE_250D_Steel` templates based on pole material (currently uses base NESC 250D with a single template).
3. **FITNES "At Replacement" criteria** — Per LD20055, implement deterioration-based analysis using LD40600 parameters.
4. **Special loading conditions** — Unbalanced longitudinal load, broken conductor, buckle analysis per LD20055 Table 4.
5. **PGE Report** — Add a portland_nesc-specific PLA report type that includes extreme ice and fire wind results.

---

## Sync & Compile

```bash
dim sync --module portland_nesc --path ./portland_nesc --types all
dim analyze --module portland_nesc 2>&1 | python3 scripts/dim_analyze_filter.py
```
