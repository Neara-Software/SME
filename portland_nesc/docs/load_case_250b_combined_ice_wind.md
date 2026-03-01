# Load Case: Rule 250B — Combined Ice and Wind

## Description

NESC Rule 250B combined ice and wind loading. Applies standard NESC ice and wind parameters based on the NESC loading district (Heavy, Medium, or Light) and the grade of construction (B or C). PGE overrides the base NESC behaviour for guy/anchor checks: guys are always evaluated at Grade B regardless of the structure's grade of construction.

## References

- NESC C2-2017, Rule 250B
- PGE LD20055, Table 1 (load and strength factors)
- PGE LD20055, Table 5 (guy/anchor factors — always Grade B)
- PGE LD20020, Table 1 (weather parameters by loading district)

## Weather Parameters

Standard NESC 250B parameters by loading district:

| Loading District | Temperature | Radial Ice | Wind Pressure | Constant (k) |
|---|---|---|---|---|
| Heavy | 0 deg F | 0.50 in | 4 psf | 0.30 |
| Medium | +15 deg F | 0.25 in | 4 psf | 0.20 |
| Light | +30 deg F | 0 in | 9 psf | 0.05 |

## Load and Strength Factors

Standard NESC 250B load and strength factors apply per grade of construction. Environment templates encode these factors directly:

| Loading District | Grade | Environment Template |
|---|---|---|
| Heavy | B | `250B_Hvy B` |
| Heavy | C / N | `250B_Hvy C` |
| Medium | B | `250B_Med B` |
| Medium | C / N | `250B_Med C` |
| Light | B | `250B_Lgt B` |
| Light | C / N | `250B_Lgt C` |

### PGE Guy/Anchor Override (LD20055 Table 5)

Guys and anchors must always be designed to Grade B load and strength factors, even when the structure is Grade C. When the pole is Grade C, a second FEA simulation is run using the Grade B environment to evaluate stay utilization.

| Component | Strength Factor |
|---|---|
| Guy wire | 0.9 |
| Anchor | 1.0 |

## Applicability Criteria

This load case applies to **all poles** in the PGE service territory. The loading district is determined by geospatial query against `dt_nesc_loading_zones` at both the pole location and the strain section geometries. The heaviest district found governs.

| Criterion | Source |
|---|---|
| Loading district (pole) | `geo_query(dt_nesc_loading_zones, pole.geometry)` |
| Loading district (strain section) | `geo_query(dt_nesc_loading_zones, geo_collection(spans[].section[].geometry))` |
| Grade of construction | Rule 243 output (`grade_of_construction`) |

## Implementation

- **Processing type:** `portland_nesc~PoleLoadingRule250bProcessing`
- **Calculator type:** `nesc~PoleLoadingRule250bCalculator` (base NESC, with PGE Processing injected via DI)
- **Simulations:** 8 wind directions, non-network solve
- **Guy override:** `simulations_grade_b` runs only when `grade <> "B"` and stays exist; `max_stay` uses Grade B simulation results
