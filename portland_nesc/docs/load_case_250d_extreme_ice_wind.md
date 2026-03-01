# Load Case: Rule 250D — Extreme Ice with Concurrent Wind

## Description

NESC Rule 250D extreme ice with concurrent wind loading. Ice thickness and concurrent wind speed are geographically determined from NESC geospatial data. PGE overrides the base NESC with different load/strength factors for steel versus wood/FRP poles, and applies the Grade B guy override (guys always evaluated at Grade B).

## References

- NESC C2-2017, Rule 250D
- PGE LD20055, Table 3 (extreme ice + wind load and strength factors)
- PGE LD20055, Table 5 (guy/anchor factors — always Grade B)

## Weather Parameters

Ice thickness and concurrent wind speed are geographically determined:

| Parameter | Source |
|---|---|
| Ice thickness | `dt_250d_ice` geospatial lookup |
| Concurrent wind speed | `dt_250d_wind` geospatial lookup |
| Temperature | Per NESC 250D (15 deg F) |

Typical PGE service area values:

| Zone | Ice Thickness | Wind Speed |
|---|---|---|
| Lower elevations | 0.50 in | 30 mph |
| Higher elevations / gorge | 1.00 - 1.50 in | 30 - 40 mph |

### Ice Thickness by Grade

| Grade | Ice Thickness |
|---|---|
| B | 100% of geodata value |
| C / N | 80% of geodata value (per NESC 250D) |

## Load and Strength Factors

PGE LD20055 Table 3 specifies different factors by pole material:

### Wood / FRP Poles

| Factor | Value |
|---|---|
| Wind load factor | 1.0 |
| Wire tension load factor | 1.0 |
| Vertical load factor | 1.0 |
| Strength factor — Wood | 0.75 |
| Strength factor — FRP | 1.0 |

**Environment template:** `PGE_250D_Wood`

### Steel Poles

| Factor | Value |
|---|---|
| Wind load factor | 1.1 |
| Wire tension load factor | 1.1 |
| Vertical load factor | 1.1 |
| Strength factor — Steel | 1.0 |

**Environment template:** `PGE_250D_Steel`

### PGE Guy/Anchor Override (LD20055 Table 5)

When grade is not B, a second simulation is run with the Grade B environment (full geodata ice, no 0.8 reduction) for stay/guy evaluation.

## Applicability Criteria

| Criterion | Condition |
|---|---|
| Pole height exceeds 60 ft | `pole.height > 60ft` |
| OR any span exceeds 60 ft max height | `any(span_stacks[].u_span_height[].max_height > 60ft)` |
| AND geodata available | `dt_250d_ice` and `dt_250d_wind` return results at pole location |

If criteria are not met, the load case is skipped and the output is null.

**Steel detection:** `pole.type.material = "steel"` determines which environment template is used.

## Implementation

- **Processing type:** `portland_nesc~PoleLoadingRule250dProcessing`
- **Calculator type:** `nesc~PoleLoadingRule250dCalculator` (base NESC, with PGE Processing injected via DI)
- **Environment override:** `make_environment(template: env, wind_pressure: 0.00256 * V^2 psf, ice_radial_thickness: ice)`
- **Grade B guy simulation:** `simulations_grade_b` runs when `grade <> "B"`, `nesc250d_required`, and stays exist; uses full geodata ice (no 0.8 factor)
- **Simulations:** 8 wind directions, non-network solve; only runs when `nesc250d_required` is true
