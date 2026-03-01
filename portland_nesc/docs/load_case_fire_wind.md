# Load Case: Fire Wind (PGE-Specific)

## Description

PGE-specific fire wind loading condition for poles located within wildfire risk areas. Wind speed depends on the voltage class of the facility. This load case does not exist in base NESC — it is a PGE reliability requirement defined in LD20055 Table 4.

## References

- PGE LD20055, Table 4 (special loading conditions — fire wind)
- PGE LD20020, Fire Wind Loading section

## Weather Parameters

| Voltage Class | Wind Speed (mph) | Wind Pressure (psf) |
|---|---|---|
| Distribution (< 57 kV) | 85 | 18.5 |
| Transmission (>= 57 kV) | 110 | 31.0 |

| Parameter | Value |
|---|---|
| Temperature | 60 deg F |
| Ice | None |

Wind pressure is calculated as `0.00256 * V^2` psf:
- Distribution: `0.00256 * 85^2 = 18.5 psf`
- Transmission: `0.00256 * 110^2 = 31.0 psf`

## Load and Strength Factors

PGE LD20055 Table 4:

| Factor | Value |
|---|---|
| Wind load factor | 1.1 |
| Wire tension load factor | 1.1 |
| Vertical load factor | 1.1 |
| Longitudinal load factor | 1.1 |

### Strength Factors

| Pole Material | Strength Factor |
|---|---|
| Wood | 0.75 |
| Steel | 1.0 |

**Environment template:** `PGE_FireWind` (single template, wind pressure overridden at runtime)

## Applicability Criteria

| Criterion | Condition |
|---|---|
| Pole spans intersect a wildfire risk area | `geo_query(dt_wildfireriskarea, pole.spans[].geometry, 10ft)` returns results |

If the pole is not in a wildfire risk area, the load case is skipped and the output is null.

### Voltage Classification

| Class | Condition |
|---|---|
| Transmission | `max(pole.spans[].section[].voltage) >= 57 kV` |
| Distribution | All other |

## Data Sources

| Data Table | Description |
|---|---|
| `dt_wildfireriskarea` | Wildfire risk area boundaries (geospatial) |

If the wildfire risk area data table is not loaded in the model, `fire_wind_required` returns false and the load case is skipped gracefully.

## Implementation

- **Processing type:** `portland_nesc~PoleLoadingFireWindProcessing`
- **Calculator type:** `portland_nesc~PoleLoadingFireWindCalculator`
- **Wind pressure override:** `make_environment(template: env, wind_pressure: fire_wind_pressure)`
- **Simulations:** 8 wind directions, non-network solve; only runs when `fire_wind_required` is true
- **Output:** Returns environment, worst_pole, worst_stay, worst_xarm; null when not applicable
