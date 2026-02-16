# LD20020 — General Loading Requirements for Overhead Lines

## Purpose

Portland General Electric (PGE) design standard LD20020 defines the loading conditions applied to overhead line structures within the PGE service territory. It specifies NESC loading districts, extreme wind parameters, extreme ice parameters, and fire wind requirements.

## References

- NESC C2-2017, Rules 250B, 250C, 250D
- LD20055 — Grades of Construction, Load Factors, and Strength Factors
- LD40600 — Pole Loading Analysis Guidelines

---

## Loading Districts

PGE service territory loading zones:

| Area | Loading District |
|---|---|
| PGE general service area | Medium |
| Hatched area (per NESC Figure 250-1) | Heavy |
| All 230 kV and above transmission | Heavy |

**Data source:** `dt_nesc_loading_zones` (existing NESC geospatial data table)

---

## Table 1 — Rule 250B Combined Ice and Wind Loading

Standard NESC 250B loading parameters by district:

| Loading District | Temperature | Radial Ice | Wind Pressure | Constant (k) |
|---|---|---|---|---|
| Heavy | 0 deg F | 0.50 in | 4 psf | 0.30 |
| Medium | +15 deg F | 0.25 in | 4 psf | 0.20 |
| Light | +30 deg F | 0 in | 9 psf | 0.05 |

---

## Rule 250C — Extreme Wind

### Basic Wind Speed

PGE basic wind speed: **85 mph** for all grades of construction.

Per LD20055, PGE applies Grade B wind speed to all facilities regardless of actual grade of construction. The 85 mph value is the Grade B basic wind speed from the NESC extreme wind map for the PGE service area.

### Height-Varying Wind Pressure

NESC 250C calculates wind pressure that varies with height above ground. The basic wind speed of 85 mph corresponds to the following approximate pressures by height band:

| Height Band (ft AGL) | Wind Speed (mph) | Wind Pressure (psf) |
|---|---|---|
| 0 - 33 | 85 | 18.5 |
| 33 - 60 | 86 | 18.9 |
| 60 - 100 | 90 | 20.7 |
| 100 - 150 | 93 | 22.1 |

**Note:** Neara handles the NESC 250C height-varying wind pressure calculations internally using the basic wind speed input. The implementation provides the basic wind speed (85 mph), and the `make_environment` function with the 250C template applies the correct height-based adjustments.

### Applicability

PGE extends 250C to **ALL structure heights**. Base NESC only requires 250C for structures and spans exceeding 60 ft. PGE removes this height threshold.

**Data source:** `dt_250c_grb_wind_speed` (existing NESC geospatial wind speed map — Grade B values used for all grades)

---

## Rule 250D — Extreme Ice with Concurrent Wind

### Geographic Zones

PGE 250D ice and wind parameters are geographically determined:

| Parameter | Data Source |
|---|---|
| Ice thickness | `dt_250d_ice` (NESC geospatial ice map) |
| Concurrent wind speed | `dt_250d_wind` (NESC geospatial wind map) |

Typical PGE service area values:

| Zone | Ice Thickness | Wind Speed |
|---|---|---|
| Lower elevations | 0.50 in | 30 mph |
| Higher elevations / gorge | 1.00 - 1.50 in | 30 - 40 mph |

### Applicability

Same as base NESC — applies when 250D geospatial data is available at the pole location.

---

## Extreme Ice (PGE-Specific — No Concurrent Wind)

PGE requires an extreme ice loading condition without concurrent wind, beyond what base NESC defines. This is a reliability requirement.

### Table 2 — Extreme Ice Parameters

| Loading District | Temperature | Ice Thickness | Wind Pressure |
|---|---|---|---|
| Medium | 32 deg F | 0.5 in | 0 psf |
| Heavy | 32 deg F | 1.0 in | 0 psf |

Load and strength factors per LD20055 Table 4.

**Data source:** `portland_nesc~dt_extreme_ice_loading` (new data table)

---

## Fire Wind Loading

PGE requires fire wind loading for all poles located within High Fire Risk Zones (HFRZs). This applies regardless of structure height.

### Wind Speeds

| Voltage Class | Wind Speed | Wind Pressure |
|---|---|---|
| Distribution (< 57 kV) | 85 mph | 18.5 psf |
| Transmission (>= 57 kV) | 110 mph | 31.0 psf |

### Applicability

Fire wind loading applies when the pole is located within a PGE-designated High Fire Risk Zone.

**Data sources:**
- `dt_pge_hfrz` — PGE High Fire Risk Zone boundaries (geospatial)
- `portland_nesc~dt_fire_wind_speed` — Wind speed by voltage class (new data table)

### High Fire Risk Zones

PGE HFRZs are geographically defined areas with elevated wildfire risk. The `dt_pge_hfrz` data table must be loaded into the Neara model with the HFRZ boundary polygons. If the data table is not available, fire wind checks are skipped.

---

## Table 2 — Complete Loading Conditions Matrix

Summary of all loading conditions applied in PGE territory:

| Loading Condition | Rule | Temperature | Ice | Wind | Applicability |
|---|---|---|---|---|---|
| Combined ice + wind (Heavy) | 250B | 0 deg F | 0.50 in | 4 psf | Heavy district |
| Combined ice + wind (Medium) | 250B | 15 deg F | 0.25 in | 4 psf | Medium district |
| Extreme wind | 250C | 60 deg F | 0 in | 85 mph (height-varying) | All poles (PGE extends to all heights) |
| Extreme ice + wind | 250D | per map | per map | per map | Where 250D data available |
| Extreme ice (no wind) | PGE | 32 deg F | 0.5/1.0 in | 0 psf | All poles (by district) |
| Fire wind (distribution) | PGE | 60 deg F | 0 in | 85 mph | Poles in HFRZ, < 57 kV |
| Fire wind (transmission) | PGE | 60 deg F | 0 in | 110 mph | Poles in HFRZ, >= 57 kV |
