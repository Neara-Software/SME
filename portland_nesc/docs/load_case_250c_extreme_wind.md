# Load Case: Rule 250C — Extreme Wind

## Description

NESC Rule 250C extreme wind loading with height-varying wind pressure. PGE overrides the base NESC in three ways: (1) always uses Grade B wind speed regardless of structure grade, (2) applies to poles and spans exceeding 60 ft (base NESC also uses 60 ft threshold), and (3) uses different load/strength factors for steel versus wood/FRP poles.

## References

- NESC C2-2017, Rule 250C
- PGE LD20055, Table 2 (extreme wind load and strength factors)
- PGE LD20020, Rule 250C section (basic wind speed)

## Weather Parameters

| Parameter | Value | Source |
|---|---|---|
| Basic wind speed | 85 mph (Grade B, PGE service area) | `dt_250c_grb_wind_speed` geospatial lookup |
| Temperature | 60 deg F | Per NESC 250C |
| Ice | None | Per NESC 250C |
| Wind pressure | Height-varying, calculated from basic wind speed | `0.00256 * V^2` psf at reference height |

Wind pressure varies with height above ground per NESC 250C formulas. Approximate pressures:

| Height Band (ft AGL) | Wind Speed (mph) | Wind Pressure (psf) |
|---|---|---|
| 0 - 33 | 85 | 18.5 |
| 33 - 60 | 86 | 18.9 |
| 60 - 100 | 90 | 20.7 |
| 100 - 150 | 93 | 22.1 |

## Load and Strength Factors

PGE LD20055 Table 2 specifies different factors by pole material:

### Wood / FRP Poles

| Factor | Value |
|---|---|
| Wind load factor | 1.0 |
| Wire tension load factor | 1.0 |
| Vertical load factor | 1.0 |
| Strength factor — Wood | 0.75 |
| Strength factor — FRP | 1.0 |

**Environment template:** `PGE_250C_Wood`

### Steel Poles

| Factor | Value |
|---|---|
| Wind load factor | 1.1 |
| Wire tension load factor | 1.1 |
| Vertical load factor | 1.1 |
| Strength factor — Steel | 1.0 |

**Environment template:** `PGE_250C_Steel`

## Applicability Criteria

| Criterion | Condition |
|---|---|
| Pole height exceeds 60 ft | `pole.height > 60ft` |
| OR any span exceeds 60 ft max height | `any(span_stacks[].u_span_height[].max_height > 60ft)` |

If neither criterion is met, the load case is skipped and the output is null.

**PGE override:** Always uses Grade B wind speed from `dt_250c_grb_wind_speed`, never the Grade C map.

**Steel detection:** `pole.type.material = "steel"` determines which environment template is used.

## Implementation

- **Processing type:** `portland_nesc~PoleLoadingRule250cProcessing`
- **Calculator type:** `nesc~PoleLoadingRule250cCalculator` (base NESC, with PGE Processing injected via DI)
- **Wind pressure override:** `make_environment(template: env, wind_pressure: 0.00256 * V^2 psf)`
- **Simulations:** 8 wind directions, non-network solve; only runs when `nesc250c_required` is true
