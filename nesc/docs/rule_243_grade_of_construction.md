# NESC Rule 243 — Grade of Construction (Pole)

## Standard Reference

NESC Rule 243 determines the grade of construction for a pole by taking the highest grade across all conductors attached to it and any nearby conflicting lines. The grade hierarchy is: N < C < B.

Rule 243 consumes the span-level Rule 242 results. Each span's `elevated_grade` already accounts for:
- Base grade by voltage/conductor type
- Crossings with lower conductors (Table 242-1)
- Railroad, limited-access highway, and navigable waterway crossings

Rule 243 also checks for **structure conflicts** — whether the pole falling over would contact conductors of another nearby line. Per NESC, a structure conflict exists when "a line [is] so situated with respect to a second line that the overturning of the first line will result in contact between its supporting structures or conductors and the conductors of the second line, assuming that no conductors are broken in either line." If a conflict is detected, the pole must match the grade of the conflicting spans.

Rule 243 aggregates own span results plus any conflict span grades to a single pole-level grade, which downstream rules (250B, 250C, 250D, 277) consume.

### Pass/Fail

Rule 243 does not have a pass/fail — it produces a grade of construction consumed by structural loading rules.

## Architecture

### Dependency Chain

```
Span → PoleLoadingSpanCheckManager → Rule 242 (per span)
                                          │
                                          ▼ elevated_grade
Pole → PoleLoadingCheckManager → Rule 243 (aggregates own spans + conflict spans)
                                          │
                                          ▼ grade_of_construction, is_structure_conflict
                              Rules 250B/C/D → Rule 277
```

### File Structure

```
nesc/Types/
  nesc~PoleLoadingRule243Calculator.neara.hjson    Calculator (3 fields)
  nesc~PoleLoadingRule243Processing.neara.hjson    Processing (8 fields)
  nesc~PoleLoadingCheckManager.neara.hjson         Pole check orchestration
```

## Calculator — `nesc~PoleLoadingRule243Calculator`

Token: `nesc~ct_PoleLoadingRule243Calculator`

Thin wrapper that delegates to Processing and shapes the output. Supports DI — the `processing` field can be overridden by customer modules to inject custom Processing (e.g., Portland NESC adds `is_major_highway`).

### Fields

| Field | Description |
|---|---|
| `model_input` | `type_only("PoleLoadingModelInput")` — pole geometry, spans |
| `processing` | `make_immutable_record("PoleLoadingRule243Processing", model_input: model_input)` |
| `output` | `{grade_of_construction: processing.worst_grade, is_structure_conflict: processing.is_structure_conflict}` |

### Output Structure

```
{
  grade_of_construction: "N" | "C" | "B",
  is_structure_conflict: true | false,
}
```

## Processing — `nesc~PoleLoadingRule243Processing`

Token: `nesc~ct_PoleLoadingRule243Processing`

Collects Rule 242 elevated grades from all spans connected to the pole and from nearby conflicting lines, then selects the worst case.

### Fields

| Field | Description |
|---|---|
| `conflict_grades` | `conflict_spans[].u_pla_span_checks.rule_242_output.elevated_grade` — Rule 242 grades from conflict spans |
| `conflict_spans` | Nearby spans from other lines within fall reach (two-stage distance filter) |
| `is_structure_conflict` | `len(conflict_spans) > 0` — boolean flag for reporting |
| `model_input` | `type_only("PoleLoadingModelInput")` — pole geometry, spans |
| `pole_base` | `vec3(model_input.pole.location, model_input.pole.ground_z)` — 3D point at pole base for distance measurement |
| `search_radius` | `model_input.pole.height` — pole above-ground height used as fall reach |
| `span_grades` | `model_input.pole.spans[].u_pla_span_checks.rule_242_output.elevated_grade` — array of grade strings from all connected spans |
| `worst_grade` | Highest grade across own spans + conflict spans: checks for "B" first, then "C", defaults to "N" |

### Structure Conflict Detection

Conflict detection uses a two-stage distance filter to find spans from other lines within fall reach of the pole:

1. **Coarse filter** — `find_nearby_spans(pole, pole.height)` uses horizontal distance to get candidate spans within the pole's above-ground height.
2. **Exclude own spans** — Remove spans connected to this pole (`model_input.pole.spans`). Remaining spans belong to other lines.
3. **Fine 3D filter** — `measure_distance(pole_base, span)` computes the true 3D distance from the pole base to each candidate span. Only spans closer than `search_radius` pass.

The two-stage approach is necessary because `find_nearby_spans` uses horizontal distance only. A span on a steep hillside could pass the horizontal check but be well outside fall reach in 3D. `measure_distance` gives the true 3D distance from the pole base to the span.

```
let(
  nearby: find_nearby_spans(model_input.pole, search_radius),
  other_lines: filter_nulls(
    broadcast(
      ns: nearby,
      if(len(filter(model_input.pole.spans, model_input.pole.spans[] = ns)) = 0, ns),
    )
  ),
  filter(
    other_lines,
    measure_distance(pole_base, other_lines[]).distance < search_radius,
  ),
)
```

### Grade Selection Logic

Merges own span grades with conflict span grades and selects the worst:

```
let(
  all_grades: span_grades ++ conflict_grades,
  if(
    len(filter(all_grades, all_grades[] = "B")) > 0, "B",
    len(filter(all_grades, all_grades[] = "C")) > 0, "C",
    "N",
  ),
)
```

## CheckManager Integration

In `nesc~PoleLoadingCheckManager`:

```
rule_243_output:
  make_immutable_record(
    "nesc~PoleLoadingRule243Calculator",
    model_input: nesc_pla_model_input,
  ).output
```

The output feeds into Rules 250B, 250C, 250D, and 277 as the `rule_243_output` parameter.

## Future Enhancement — Conductor Attachment Reach

The current search radius uses pole height (pole top pivot at base). A more accurate reach would consider conductor attachments: `sqrt(attach_height² + attach_horizontal_offset²)` for each attachment point, taking the maximum. This accounts for crossarm reach and would replace `pole.height` as the search radius.

## Sync & Compile

```bash
dim sync --module nesc --path . --types nesc~PoleLoadingRule243Calculator nesc~PoleLoadingRule243Processing
dim analyze --module nesc 2>&1 | python3 scripts/dim_analyze_filter.py
```
