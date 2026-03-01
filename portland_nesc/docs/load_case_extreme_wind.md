# Load Case: Extreme Wind (PGE-Specific — Ground Line Strength)

## Description

PGE-specific extreme wind loading condition for ground-line strength assessment. This is separate from NESC Rule 250C and applies primarily to shorter structures (60 ft and under) and all steel poles. Wood/FRP poles taller than 60 ft are evaluated under Rule 250C instead, not this load case.

## References

- PGE LD20055, Table 2 (extreme wind load and strength factors)
- PGE LD20020 (general loading requirements)

## Weather Parameters

Wind speed depends on pole height:

| Pole Height | Wind Speed (mph) | Wind Pressure (psf) |
|---|---|---|
| 60 ft and under | 70 | 12.5 |
| Over 60 ft | 90 | 20.7 |

| Parameter | Value |
|---|---|
| Temperature | 60 deg F |
| Ice | None |

Wind pressure is calculated as `0.00256 * V^2` psf and applied via `make_environment`.

## Load and Strength Factors

PGE LD20055 Table 2:

### Wood / FRP Poles

| Factor | Value |
|---|---|
| Wind load factor | 1.0 |
| Wire tension load factor | 1.0 |
| Vertical load factor | 1.0 |
| Strength factor — Wood | 0.75 |
| Strength factor — FRP | 1.0 |

**Environment template:** `PGE_ExtremeWind_Wood`

### Steel Poles

| Factor | Value |
|---|---|
| Wind load factor | 1.1 |
| Wire tension load factor | 1.1 |
| Vertical load factor | 1.1 |
| Strength factor — Steel | 1.0 |

**Environment template:** `PGE_ExtremeWind_Steel`

## Applicability Criteria

| Criterion | Condition |
|---|---|
| Pole height 60 ft or under | `pole.height <= 60ft` |
| OR pole is steel | `pole.type.material = "steel"` |

Wood/FRP poles taller than 60 ft are excluded — they are covered by Rule 250C instead.

If neither criterion is met, the load case is skipped and the output is null.

## Implementation

- **Processing type:** `portland_nesc~PoleLoadingExtremeWindProcessing`
- **Calculator type:** `portland_nesc~PoleLoadingExtremeWindCalculator`
- **Wind pressure override:** `make_environment(template: env, wind_pressure: 0.00256 * V^2 psf)`
- **Simulations:** 8 wind directions, non-network solve; only runs when `extreme_wind_required` is true
- **Output:** Returns environment, wind_speed, worst_pole, worst_stay, worst_xarm; null when not applicable
