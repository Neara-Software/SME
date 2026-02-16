# LD20055 — Grades of Construction, Load Factors, and Strength Factors

## Purpose

Portland General Electric (PGE) design standard LD20055 defines PGE-specific grades of construction, load factors, and strength factors that overlay base NESC requirements. This standard governs structural loading analysis for all PGE overhead facilities.

## References

- NESC C2-2017, Rules 242, 243, 250B, 250C, 250D, 277
- LD20020 — General Loading Requirements for Overhead Lines
- LD40600 — Pole Loading Analysis Guidelines (FITNES parameters)

---

## Grade of Construction (Rules 242/243)

### Grade B Criteria

PGE requires Grade B construction for all base NESC criteria plus the following PGE-specific additions:

| Condition | Base NESC | PGE Addition |
|---|---|---|
| Transmission lines (>= 57 kV) | Grade B | Same |
| Railroad crossings | Grade B | Same |
| Limited-access highway crossings | Grade B | Same |
| Navigable waterway crossings | Grade B | Same |
| Adjacent structural conflict with railroad or major highway | — | **Grade B** |
| 4-lane highway with speed limit >= 55 mph | — | **Grade B** |

### Grade C Criteria

All other facilities not meeting Grade B criteria are designed to Grade C.

---

## Table 1 — Rule 250B Pole Load and Strength Factors

Standard NESC 250B load and strength factors apply per loading district and grade of construction. PGE uses the base NESC environment templates (`250B_Hvy B`, `250B_Hvy C`, `250B_Med B`, `250B_Med C`).

**PGE Override — Guys/Anchors Always Grade B:**

Per Table 5 (below), all guying and anchoring must be designed to Grade B load/strength factors regardless of the structure's grade of construction. When the pole is Grade C, a separate Grade B simulation is run to evaluate guy/stay utilization.

---

## Table 2 — Rule 250C Extreme Wind Load and Strength Factors

PGE extends NESC Rule 250C to **ALL structure heights** (base NESC only requires 250C for structures/spans > 60 ft). PGE also applies **Grade B wind speed** for all facilities regardless of grade of construction.

**Basic wind speed:** 85 mph (per LD20020). Neara automatically calculates height-varying wind pressures using NESC 250C code formulas.

### Wood/FRP Poles

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

---

## Table 3 — Rule 250D Extreme Ice with Concurrent Wind Load and Strength Factors

PGE applies 250D extreme ice with concurrent wind. Ice and wind parameters are geographic and come from LD20020 (see `LD20020_general_loading_requirements.md`).

### Wood/FRP Poles

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

---

## Table 4 — Special Loading Conditions

PGE defines additional loading conditions beyond base NESC. These are PGE reliability requirements.

### Extreme Ice (No Concurrent Wind)

Applies to all poles based on loading district.

| Factor | Wood/FRP | Steel |
|---|---|---|
| Wind load factor | 1.1 | 1.1 |
| Wire tension load factor | 1.1 | 1.1 |
| Vertical load factor | 1.1 | 1.1 |
| Longitudinal load factor (general) | 1.0 | 1.1 |
| Longitudinal load factor (dead ends) | 1.1 | 1.1 |
| Strength factor — Wood | 0.75 | — |
| Strength factor — FRP | 0.75 | — |
| Strength factor — Steel | — | 1.0 |

**Parameters (from LD20020 Table 2):**

| Loading District | Temperature | Ice Thickness | Wind Pressure |
|---|---|---|---|
| Medium | 32 deg F | 0.5 in | 0 psf |
| Heavy | 32 deg F | 1.0 in | 0 psf |

**Environment templates:** `PGE_ExtremeIce_Wood_Med`, `PGE_ExtremeIce_Wood_Hvy`, `PGE_ExtremeIce_Steel_Med`, `PGE_ExtremeIce_Steel_Hvy`

### Fire Wind

Applies to all poles in High Fire Risk Zones (HFRZs).

| Factor | Wood | Steel |
|---|---|---|
| Wind load factor | 1.1 | 1.1 |
| Wire tension load factor | 1.1 | 1.1 |
| Vertical load factor | 1.1 | 1.1 |
| Longitudinal load factor | 1.1 | 1.1 |
| Strength factor — Wood | 0.75 | — |
| Strength factor — Steel | — | 1.0 |

**Parameters (from LD20020):**

| Voltage Class | Wind Speed | Wind Pressure |
|---|---|---|
| Distribution (< 57 kV) | 85 mph | 18.5 psf |
| Transmission (>= 57 kV) | 110 mph | 31.0 psf |

**Environment templates:** `PGE_FireWind_Wood`, `PGE_FireWind_Steel`

### Other Special Loading Conditions (Future)

The following PGE special loading conditions are documented but not yet implemented:

- **Unbalanced longitudinal load** — intact deadend or angle pole with unbalanced wire tension
- **Broken conductor** — single conductor broken on one side
- **Buckle** — pole buckling analysis under combined axial and lateral loads

---

## Table 5 — Guy and Anchor Factors

> "Guying and anchoring must be designed for Grade B even if the structure is allowed to be built to lesser requirements."

| Component | Strength Factor |
|---|---|
| Guy wire | 0.9 |
| Anchor | 1.0 |

**Implementation:** For Rule 250B, when grade of construction is C, a second simulation using the Grade B environment is run to evaluate guy/stay utilization. For 250C/250D/extreme ice/fire wind, the guy strength factors are encoded directly in the environment templates and do not vary by grade.

---

## Table 6 — Crossarm Factors

Standard NESC crossarm strength factors apply. No PGE-specific override.

---

## Table 7 — Insulator Factors (Rule 277)

PGE-specific insulator strength factors for Rule 277. Standard NESC Rule 277 factors apply — no PGE override is needed at this time.

---

## FITNES "At Replacement" Criteria

PGE uses FITNES (Facility Inspection Tracking and Engineering System) criteria for "at replacement" analysis. These criteria reference LD40600 for specific pole deterioration parameters. Implementation of FITNES criteria is a future enhancement.
