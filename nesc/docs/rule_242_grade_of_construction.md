# NESC Rule 242 — Grade of Construction (Crossings)

## Standard Reference

NESC Rule 242 determines the required grade of construction for supply and communication conductors based on their crossings with other conductors. The base grade is assigned by voltage level, then **elevated** if the conductor crosses over (or shares a structure with) a lower conductor, a railroad, a freeway, or a navigable waterway.

Table 242-1 defines the minimum construction grade for each combination of upper and lower conductor type at a crossing.

### Table 242-1 — Required Grade at Crossings

The table uses seven conductor keys (rows and columns):

| Key | Description |
|---|---|
| `Communications` | COMMS-class conductors |
| `LessThen750V` | Open supply, voltage <= 750 V phase-to-ground |
| `OpenLessThen2point9kV` | Open supply, 750 V < voltage <= 2.9 kV p-g (5 kV p-p) |
| `OpenLessThen22kV` | Open supply, 2.9 kV < voltage <= 22 kV p-g |
| `CableLessThen22kV` | Cable supply, voltage <= 22 kV p-g |
| `CableGreaterThen22kV` | Cable supply, voltage > 22 kV p-g |
| `OpenGreaterThen22kV` | Open supply, voltage > 22 kV p-g |

Full 7x7 matrix (49 cells):

| Upper \ Lower | Comms | <750V | Open<=2.9kV | Open<=22kV | Cable<=22kV | Cable>22kV | Open>22kV |
|---|---|---|---|---|---|---|---|
| **Communications** | N | N | C | B | C | C | B |
| **LessThen750V** | N | N | C | C | C | C | B |
| **CableLessThen22kV** | C | N | C | C | N | N | B |
| **OpenLessThen2point9kV** | **C** | C | C | C | C | C | B |
| **OpenLessThen22kV** | B | C | C | C | C | C | B |
| **CableGreaterThen22kV** | C | C | C | C | C | C | B |
| **OpenGreaterThen22kV** | B | B | B | B | B | B | B |

### Footnote 6 — Low-Voltage Open Supply Exception

NESC Table 242-1 Footnote 6 states:

> *"Grade C construction may be used if the voltage does not exceed 5.0 kV phase to phase or 2.9 kV phase to ground."*

This applies to crossings between open supply conductors and communications conductors where the table would otherwise require Grade B. The implementation splits the former `OpenLessThen22kV` range into two keys:

- **`OpenLessThen2point9kV`** (voltage <= 2.9 kV p-g): Gets Grade **C** when crossing Communications (Footnote 6 applied)
- **`OpenLessThen22kV`** (voltage > 2.9 kV p-g): Retains Grade **B** when crossing Communications

This data-driven approach avoids conditional logic in formulas — the distinction is encoded directly in the table rows and the `get_key` classifier.

### Base Grade (no crossings)

| Conductor | Base Grade |
|---|---|
| COMMS | N |
| Supply <= 750 V p-g | N |
| Supply > 750 V p-g | C |
| Supply >= 22 kV p-g | B |

### Grade Elevation

Grades can only be elevated, never lowered. The hierarchy is: N < C < B.

A conductor's grade is elevated if **any** of the following applies:
- It crosses a railroad → Grade B
- It crosses a limited-access highway → Grade B
- It crosses a navigable waterway → Grade B
- It crosses or shares a structure with a lower conductor whose crossing grade (from Table 242-1) or own elevated grade is higher

### Pass/Fail

Rule 242 does not have a pass/fail — it produces a grade of construction that downstream rules (243, 250B/C/D, 277) consume to determine structural requirements.

## Architecture

### Dependency Chain

```
Span → PoleLoadingSpanCheckManager → Rule242Calculator → Rule242Processing
                                          │
                                          ├── get_key (classifies conductor by voltage/type)
                                          ├── get_crossing_grade (Table 242-1 lookup)
                                          ├── process_crossing_spans (compares grades at crossings)
                                          └── {base_grade, elevated_grade, elevated_reason}
                                                │
                                                ▼
                              Rule 243 → Rules 250B/C/D → Rule 277
```

Rule 242 is a **span-level** check. Each span independently computes its grade, then crossing logic compares upper/lower span grades. The result feeds into the pole-level Rule 243 (which takes the highest grade across all spans on the pole).

### File Structure

```
nesc/Types/
  nesc~PoleLoadingRule242Calculator.neara.hjson    Calculator (12 fields)
  nesc~PoleLoadingRule242Processing.neara.hjson    Processing (9 fields)
  nesc~PoleLoadingSpanCheckManager.neara.hjson     Span check orchestration
  nesc~PoleLoadingCheckManager.neara.hjson         Pole check orchestration

nesc/DataTables/
  nesc~242-1 conductor crossing.neara.hjson        Table 242-1 crossing grades (TSV, 49 rows)
```

## Calculator — `nesc~PoleLoadingRule242Calculator`

Token: `nesc~ct_PoleLoadingRule242Calculator`

Contains both the computation logic and the key classification / table lookup lambdas.

### Inputs

| Field | Description |
|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` — span geometry, section, voltages |
| `processing` | `make_immutable_record("PoleLoadingRule242Processing", model_input: model_input)` |

### Key Classification — `get_key`

Lambda that classifies a conductor into one of the seven table keys.

```
lambda(
  voltage: type_only(1kV),
  class: type_only(model().ConductorLibrary[].conductor_class[0]),
  if(
    class & "" = "COMMS",     "Communications",
    voltage <= 750V * sqrt(3), "LessThen750V",
    voltage <= 2.9kV * sqrt(3), "OpenLessThen2point9kV",
    voltage <= 22kV * sqrt(3),  "OpenLessThen22kV",
    voltage > 22kV * sqrt(3),   "OpenGreaterThen22kV",
  ),
)
```

Voltage thresholds use `sqrt(3)` to convert phase-to-ground limits to line-to-line values (the `voltage` field is line-to-line). Evaluated top-to-bottom, first match wins.

**Note:** Cable types (`CableLessThen22kV`, `CableGreaterThen22kV`) are not yet classified by `get_key` — the comment in the source notes this requires knowing the defining conductor class for closed-type cables.

### Crossing Grade Lookup — `get_crossing_grade`

Lambda that looks up the required grade for a given upper/lower conductor pair from the data table.

```
lambda(
  upper_key: type_only(""),
  lower_key: type_only(""),
  find(
    model().nesc~dt_242_1_conductor_crossing,
    and(
      model().nesc~dt_242_1_conductor_crossing[].upper_conductor = upper_key,
      model().nesc~dt_242_1_conductor_crossing[].lower_conductor = lower_key,
    ),
  ).required_grade_upper,
)
```

### Base Grade — `base_grade`

Assigns the initial grade based solely on the span's own voltage (no crossings):

```
if(
  processing.type = "COMMS", "N",
  processing.voltage <= 750V * sqrt(3), "N",
  processing.voltage > 750V * sqrt(3), "C",
  processing.voltage >= 22kV * sqrt(3), "B",
)
```

### Crossing Processing — `process_crossing_spans`

Lambda that evaluates all crossings for a given set of lower spans and determines if the upper conductor's grade should be elevated.

```
lambda(
  lower_spans: ...,
  reason: type_only(""),
  ...
)
```

For each lower span:
1. Classifies both upper and lower conductor via `get_key`
2. Looks up the crossing grade from Table 242-1 via `get_crossing_grade`
3. Reads the lower conductor's own elevated grade (from its Rule 242 output)
4. If either the crossing grade or the lower conductor's elevated grade exceeds the upper conductor's base grade → returns an elevation record `{grade, reason}`

The lambda is called three times with different span sets:
- `attached_crossing` — spans attached to the same structure, below
- `span_below` — common spans below on the same pole
- `unattached_crossing` — unattached crossing spans below

### Grade Elevation — `elevated_grade`

Collects all elevation records from crossings plus infrastructure crossings (railroad, freeway, waterway) and selects the highest:

- Base Grade B → no elevation possible
- Base Grade C → can be elevated to B
- Base Grade N → can be elevated to C or B

Returns `{grade, reason}` where `reason` is a comma-joined list of all elevation sources.

### All Grade Elevations — `all_grade_elevations`

Concatenates all sources of grade elevation:

```
filter_nulls(list(
  if(is_rail_crossing, {grade: "B", reason: "railroad tracks crossing"}),
  if(is_freeway_crossing, {grade: "B", reason: "limited-access highway crossing"}),
  if(is_water_crossing, {grade: "B", reason: "navigable waterways crossing"}),
) ++ attached_crossing ++ span_below ++ unattached_crossing)
```

### Output Structure

```
{
  base_grade:      "N" | "C" | "B"
  elevated_grade:  "N" | "C" | "B"
  elevated_reason: "No Change" | "railroad tracks crossing, Attached Crossing Below, ..."
}
```

## Processing — `nesc~PoleLoadingRule242Processing`

Token: `nesc~ct_PoleLoadingRule242Processing`

Provides the data inputs (voltage, conductor type, crossing spans) that the Calculator operates on. Fields are listed alphabetically per project convention.

### Inputs

| Field | Description |
|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` — span geometry, section, voltages |

### Conductor Properties

| Field | Description |
|---|---|
| `type` | `model_input.span.section.type.conductor_class` — conductor class (e.g., `"COMMS"`) |
| `voltage` | `model_input.span.section.voltage` — line-to-line voltage |

### Infrastructure Crossings

| Field | Data Table | Description |
|---|---|---|
| `is_rail_crossing` | `dt_or_railroads` | `geo_intersect` — true if span geometry intersects any railroad |
| `is_freeway_crossing` | `dt_esri_freewaysystem` | `geo_intersect` — true if span geometry intersects a limited-access highway |
| `is_water_crossing` | `dt_nhd_waterbody` | `geo_intersect` — true if span geometry intersects a navigable waterway |

### Span Crossings

Three fields find lower conductors in different spatial relationships:

| Field | Function | Description |
|---|---|---|
| `attached_crossings_below` | `find_adjacent_spans_below` | Spans attached to the same structure, below this span |
| `spans_below` | `find_spans_below` | Common spans below on the same pole |
| `unattached_crossings_below` | `find_crossing_spans_below` | Unattached crossing spans below |

Each returns an array of records:

```
{
  span:    <span object>
  voltage: span.section.voltage
  type:    span.section.type.conductor_class
  rule242: span.u_pla_span_checks.rule_242_output
}
```

The `rule242` field provides the lower span's own Rule 242 output (elevated grade), enabling the recursive grade comparison.

## CheckManager Integration

### Span Level

In `nesc~PoleLoadingSpanCheckManager`:

```
rule_242_output:
  make_immutable_record(
    "nesc~PoleLoadingRule242Calculator",
    model_input: model_input,
  ).output
```

Where `model_input` is built from the span:

```
model_input:
  make_immutable_record("nesc~PoleLoadingModelInput", span: span)
```

The span check manager is instantiated on each `Span` via the extension field `nesc~u_pla_span_checks`.

### Pole Level

In `nesc~PoleLoadingCheckManager`, Rule 242 output feeds into Rule 243:

```
rule_242_output:
  make_immutable_record(
    "nesc~PoleLoadingRule242Calculator",
    model_input: nesc_pla_model_input,
  ).output
```

Rule 243 then determines the pole's overall grade of construction from the highest grade across all spans.

## Data Tables

| DataTable | Description |
|---|---|
| `nesc~dt_242_1_conductor_crossing` | Table 242-1 crossing grades. 49 rows (7x7 matrix). Columns: `upper_conductor`, `lower_conductor`, `required_grade_upper` |
| `dt_or_railroads` | Railroad geometries for crossing detection |
| `dt_esri_freewaysystem` | Limited-access highway geometries |
| `dt_nhd_waterbody` | Navigable waterway geometries |

## Sync & Compile

```bash
dim sync --module nesc --path . --types nesc~PoleLoadingRule242Calculator nesc~PoleLoadingRule242Processing nesc~PoleLoadingSpanCheckManager
dim analyze --module nesc 2>&1 | python3 scripts/dim_analyze_filter.py
```
