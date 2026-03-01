# Load Case: Extreme Ice (PGE-Specific — No Concurrent Wind)

## Description

PGE-specific extreme ice loading condition with no concurrent wind. This load case does not exist in base NESC — it is a PGE reliability requirement defined in LD20055 Table 4. Ice thickness is determined by NESC loading district (Heavy or Medium). Light loading district poles are not subject to this load case.

## References

- PGE LD20055, Table 4 (special loading conditions)
- PGE LD20020, Table 2 (extreme ice parameters by district)

## Weather Parameters

From PGE LD20020 Table 2 and the `portland_nesc~extreme_ice_loading` data table:

| Loading District | Temperature | Ice Thickness | Wind Pressure |
|---|---|---|---|
| Heavy | 32 deg F | 1.0 in | 0 psf |
| Medium | 32 deg F | 0.5 in | 0 psf |

## Load and Strength Factors

PGE LD20055 Table 4:

| Factor | Value |
|---|---|
| Wind load factor | 1.1 |
| Wire tension load factor | 1.1 |
| Vertical load factor | 1.1 |
| Longitudinal load factor (general) | 1.0 |
| Longitudinal load factor (dead ends) | 1.1 |

### Strength Factors

| Pole Material | Strength Factor |
|---|---|
| Wood | 0.75 |
| FRP | 0.75 |
| Steel | 1.0 |

### Environment Templates

| Loading District | Environment Template |
|---|---|
| Heavy | `PGE_ExtremeIce_Hvy` |
| Medium | `PGE_ExtremeIce_Med` |

## Applicability Criteria

| Criterion | Condition |
|---|---|
| Loading district is Heavy or Medium | `is_heavy` or `is_medium` (from `dt_nesc_loading_zones` geospatial query) |

Poles in Light loading districts are not subject to this load case. The loading district is determined from both the pole location and strain section geometries, with the heaviest district governing.

| Source | Query |
|---|---|
| Pole location | `geo_query(dt_nesc_loading_zones, pole.geometry)` |
| Strain sections | `geo_query(dt_nesc_loading_zones, geo_collection(spans[].section[].geometry))` |

## Implementation

- **Processing type:** `portland_nesc~PoleLoadingExtremeIceProcessing`
- **Calculator type:** `portland_nesc~PoleLoadingExtremeIceCalculator`
- **Data table:** `portland_nesc~extreme_ice_loading` (ice parameters by district)
- **Simulations:** 8 wind directions, non-network solve
- **Output:** Returns environment, worst_pole, worst_stay, worst_xarm
