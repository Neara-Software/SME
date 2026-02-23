# NESC Rule 235E — Clearances at Fixed Supports

## What This Rule Checks

NESC Rule 235E specifies minimum clearances at fixed supports — between conductors and structural parts (crossarms, braces, pole surface), between conductors and guys/stays, and between conductors of the same or different circuits.

- **235E1**: Base clearances at fixed supports (applies to all insulator types)
- **235E2**: Additional clearance check under wind-displaced conductor positions (6 lb/ft² wind at 60°F). Only applies to **suspension insulators** that are not restrained from movement. Pin, strain, and post insulators are restrained and exempt.

Reference: NESC Table 235-6, which defines required clearances by category and voltage.

## NESC Table 235-6 Categories

| NescCategory | SubCategory | What It Covers |
|---|---|---|
| 1 | a | Conductors of the same circuit |
| 1 | b | Conductors of different circuits |
| 2 | — | Guys, span wires, messengers, surge-protection wires |
| 3 | — | Support arms, braces |
| 4 | a | Structure surface — ungrounded parts |
| 4 | b | Structure surface — grounded / neutral parts |
| 5 | a | Buildings, signs, billboards — horizontal |
| 5 | b | Buildings, signs, billboards — vertical |

## Current Implementation Status

| Category | Status |
|---|---|
| 1a/1b — Same/different circuit conductors | Implemented |
| 2 — Guys, span wires, messengers | Implemented |
| 3 — Support arms, braces | Implemented (insulator length + cross-assembly) |
| 4 — Structure surface | Stubbed (blocked on shaft-only measurement) |
| 5a/5b — Buildings, signs | Stubbed (no building geometry in platform) |

## Architecture

The implementation follows a **bijective** mapping to NESC rules — each sub-rule maps to prefixed fields within the Processing class, not separate helper types. It uses a per-span Processing pattern (same as Rule 234B).

### Data Flow

```
Pole
  u_rule235e_processing    ← broadcasts over spans, aggregates violations
  u_rule235e_output        ← instantiates Calculator, returns {pass, debug}

ClearanceRule235EProcessing  (per-span)
  e1_cables                ← span.Environments[].Cables (all environments, no wind)
  e2_applies               ← true if pole has suspension insulators
  e2_cables                ← simulate(span, environment: model().u_environment_60f_6psf).Cables
  cat1_*                   ← Category 1 fields (conductor-to-conductor)
  cat2_*                   ← Category 2 fields (guys/stays)
  cat3_*                   ← Category 3 fields (support arms — insulator length + cross-assembly)
  cat4_*                   ← Category 4 fields (structure surface — stubbed)
  cat5_*                   ← Category 5 fields (buildings — stubbed)
  violations               ← flatten(list(cat1, cat2, cat3, cat4, cat5))
  output                   ← {has_violations, num_violations, violations}

ClearanceRule235ECalculator
  passes                   ← ["✅"] or ["❌ N clearance violation(s)"]
  output                   ← {pass, debug}

Model
  u_environment_60f_6psf   ← make_environment(60°F, 6 psf wind) for 235E2
```

### Files

| File | Purpose |
|---|---|
| `nesc/Types/nesc~ClearanceRule235EProcessing.neara.hjson` | Per-span clearance logic for all categories. |
| `nesc/Types/nesc~ClearanceRule235ECalculator.neara.hjson` | Formats Processing output into pass/fail + debug info. |
| `nesc/Types/Pole.neara.hjson` | Pole extension. `u_rule235e_processing` broadcasts over spans. `u_rule235e_output` is the final result. |
| `nesc/Types/Model.neara.hjson` | Model extension. Defines `u_environment_60f_6psf` for 235E2 wind simulation. |
| `nesc/DataTables/nesc~Table235_6.neara.hjson` | Encodes NESC Table 235-6 as a DataTable with all 5 categories. |
| `nesc/Reports/nesc~NESC 235E.neara.hjson` | Report showing `u_rule235e_output` per pole. |

## Category 1 Implementation Detail

**Conductor-to-conductor clearances. 1a = same circuit, 1b = different circuits.**

Checks clearance between each conductor and every other conductor at the pole. Circuit identity is determined by `section.circuit_name`.

### Fields

- `cat1_circuit_name` — `span.section.circuit_name` (extracted to avoid module-prefix in let)
- `cat1_conductor_class` — `span.section.type.conductor_class`
- `cat1_span_voltage` — maps Comms to `-3kV` sentinel, otherwise `span.section.voltage`
- `cat1_required_same` — Table 235-6 lookup with `nesccategory = 1, subcategory = "a"`
- `cat1_required_diff` — Table 235-6 lookup with `nesccategory = 1, subcategory = "b"`
- `cat1_violations` — broadcasts over `pole.spans`, filters out self and same-section spans, determines subcategory from circuit match, measures `measure_distance(other.Environments[].Cables, e1_cables).distance`

### Filtering

Two spans are skipped:
- **Same span**: `other.label = span.label` — self-comparison
- **Same section**: `other.section = span.section` — same wire continuing through the pole (no clearance to check)

### Violation Record

```
{ rule, category: "1a" or "1b", description, span, component, required, actual }
```

### Notes

- **Required clearance varies per pair** — unlike cat2/cat3 which have a single `required_clearance` per span, cat1 computes the required clearance inside the broadcast because the subcategory (a vs b) depends on which other span is being compared
- **Voltage for lookup** — uses the current span's voltage. For a mixed-voltage pair (e.g., 12kV vs 0kV), the higher-voltage span's check will use stricter clearance requirements and catch the violation even if the lower-voltage span's check does not.
- **Circuit identification** — uses `section.circuit_name`. If this field is null/empty for both spans, they will be treated as same circuit (1a).

## Category 2 Implementation Detail

**Guys, span wires, messengers, surge-protection wires.**

Checks clearance from each conductor to each stay/guy wire at the pole.

### Fields

- `cat2_conductor_class` — `span.section.type.conductor_class`
- `cat2_span_voltage` — maps Comms to `-3kV` sentinel, otherwise `span.section.voltage`
- `cat2_required_clearance` — Table 235-6 lookup with `nesccategory = 2`
- `cat2_violations` — broadcasts over `pole.Stays`, measures `measure_distance(stay, e1_cables).distance`

### Violation Record

```
{ rule, category: "2", description: "Guy/stay clearance", span, component, required, actual }
```

### Notes

- `pole.Stays` is a built-in collection — no extension needed
- If a pole has no stays, the broadcast produces an empty list (no violations)

## Category 3 Implementation Detail

**Support arms (crossarms), braces.**

Two sub-checks:

### A) Insulator Length Check

Measures the insulator length as clearance from the conductor to its own assembly. Uses point-to-point measurement between `structure_endpoint` (on the crossarm) and `inline_endpoint` (at the insulator tip) for each cable attachment.

`measure_distance(assembly, ConductorPiece)` returns 0 because ConductorPiece geometry starts at the `structure_endpoint` (on the assembly). Point-to-point measurement works correctly.

Uses first environment only (`index(span.Environments, 0).Cables`) since insulator length is the same across all environments.

### B) Cross-Assembly Check

Measures clearance from this span's cables to OTHER assemblies on the pole using `measure_distance(assembly, cables)`. This returns 0 for the cable's own assembly (self-filtering) and the actual distance for other assemblies. Violations are flagged where `dist > 0 AND dist < required`.

### Fields

- `cat3_conductor_class` — `span.section.type.conductor_class`
- `cat3_span_voltage` — maps Comms to `-3kV` sentinel, otherwise `span.section.voltage`
- `cat3_required_clearance` — Table 235-6 lookup with `nesccategory = 3`
- `cat3_violations` — insulator length check + cross-assembly check, both E1 and E2

### Clearance Formula

```
required = BaseClearanceIn + AdderPerKvIn * max(0, (voltage - AdderThresholdKv) / unit_value(1, "kV"))
```

### Violation Records

```
{ rule, category: "3", description: "Support arms clearance", span, component: span.label, required, actual }
{ rule, category: "3", description: "Cross-arm clearance", span, component: assembly.label, required, actual }
```

## Category 4 — Structure Surface (Stubbed)

**Ungrounded (4a) and grounded (4b) parts of the pole body.**

This category checks clearance from conductors to the physical pole shaft. It is **not yet implemented** because `measure_distance(pole, cables)` returns the distance to the entire structure (shaft + assemblies), which overlaps with Category 3.

### Blocker

Need a way to measure distance to the pole shaft only (e.g., `pole.Shaft` or a shaft-only geometry accessor). Until then, `cat4_violations` returns `[]` (always passes).

### When Unblocked

- Add `cat4_span_voltage`, `cat4_required_clearance` (same pattern as cat2/cat3)
- Use subcategory filter: `nesccategory = 4` with `subcategory = "a"` (ungrounded) or `"b"` (grounded)
- Requires `AssemblyType.u_is_grounded` (already exists) or a pole-level grounded flag to distinguish 4a vs 4b

## Category 5 — Buildings, Signs, Billboards (Stubbed)

**Horizontal (5a) and vertical (5b) clearances to buildings and similar structures.**

This category checks clearance from conductors to nearby buildings, signs, and billboards. It is **not yet implemented** because the platform does not currently model building geometry.

### Blocker

Need building/structure objects in the platform that can be passed to `measure_distance`. Until then, `cat5_violations` returns `[]` (always passes).

### When Unblocked

- Add `cat5_span_voltage`, `cat5_required_clearance` (same pattern as cat2/cat3)
- Use subcategory filter: `nesccategory = 5` with `subcategory = "a"` (horizontal) or `"b"` (vertical)
- 5a may use `.distance`, 5b may need `.vertical_distance` from `measure_distance`

## 235E2 — Suspension Insulator Swing

**Rule 235E2 requires that 235E1 clearances be maintained even when suspension insulators swing under wind load.**

### How It Works

Each category's violation field checks two environments:
1. **E1 (no wind)**: Uses `e1_cables` (`span.Environments[].Cables`) — always checked for all insulator types
2. **E2 (wind swing)**: Uses `e2_cables` from `simulate()` — only checked when `e2_applies` is true

### Applicability (`e2_applies`)

235E2 only applies when suspension insulators are present. Determined by:
```
len(filter(
  pole.Assemblies[].SectionAttachments[].CableAttachments,
  pole.Assemblies[].SectionAttachments[].CableAttachments[].type[].component_type = "susp"
)) > 0
```

Note: `SectionAttachments` lives on Assembly, not Section — access via `pole.Assemblies`.

Insulator `component_type` values: `"susp"` (suspension), `"pin"`, `"strn"` (strain/dead-end), `"post"`. Only `"susp"` triggers E2 checks.

### Wind Environment

A reusable wind environment is defined once on the Model (`u_environment_60f_6psf`):
```
make_environment(
  temperature: unit_value(60, "fahrenheit"),
  wind_pressure_cond: 6 * unit("psf"),
)
```

E2 cable positions are computed dynamically using static analysis:
```
simulate(span, environment: model().u_environment_60f_6psf).Cables
```

No pre-configured environments are required on individual spans.

### Guard Pattern

Each category's violation field uses:
```
flatten(list(
  // 235E1: Always checked
  filter_nulls(broadcast(...measure_distance(..., e1_cables)...)),
  // 235E2: Only for suspension insulators
  if(e2_applies,
    filter_nulls(broadcast(...measure_distance(..., e2_cables)...)),
    [],
  )
))
```

## Known Limitations

- **Cat4/Cat5 stubbed**: Blocked on platform capabilities (shaft-only measurement, building geometry).
- **Joint-use comm distinction**: Comm cables use sentinel `-3kV` (general). Joint-use comm (`-2kV`) is not yet distinguished.
- **Cat1 circuit_name nulls**: If `section.circuit_name` is null/empty for both spans, they are treated as same circuit (1a).
- **Cat1 duplicate violations**: Each conductor pair is checked from both spans' perspectives (A checks B, B checks A). Both generate violation records if clearance is insufficient. Deduplication via label ordering isn't possible because dim's `<` operator doesn't work on Label types.
- **e2_applies is conservative**: Checks all assemblies at the pole for suspension insulators, not just the current span's assembly.

## Adding New Categories

All 5 NESC Table 235-6 categories now have entries (cat1–cat3 implemented, cat4–cat5 stubbed). To unstub a category or add new violation logic:

1. **Violation record must match existing shape**: `{ rule, category, description, span, component, required, actual }` — use `component` for the measured-against element (not `assembly`, `stay`, etc.) so `list()` type-checking passes
2. Replace the `[]` stub with real logic following the cat2/cat3 pattern
3. The DataTable already contains all category rows — no data changes needed

## dim Language Gotchas Encountered

These are specific to this implementation and may help when extending it:

- **Module prefix on `[]` operator**: `let_var[].field` inside a module context resolves `let_var` as `nesc~let_var`. Workaround: chain directly from `broadcast()` into `.output.field` instead of storing intermediate results.
- **Module prefix on `span.section.voltage`**: Inside `let()` expressions, `voltage` gets prefixed to `nesc~voltage`. Workaround: extract into a standalone formula field (`cat3_span_voltage`).
- **Unit arithmetic**: dim can't represent compound units like `in/kV`. Divide voltage difference by `unit_value(1, "kV")` to make it dimensionless, so `in * dimensionless = in`.
- **DataTable field aliases**: Platform normalizes aliases to lowercase-no-underscores (e.g., `min_voltage_kv` becomes `minvoltagekv`). Use the normalized form in formulas.
- **`list()` requires matching types**: All violation records passed to `list()` must have identical field names and types. Use a common field like `component` instead of category-specific names (`assembly`, `stay`). `concat()` is element-wise string concatenation, not list merging — use `flatten(list(...))` instead.
- **`measure_distance(assembly, ConductorPiece)` returns 0 for own assembly**: ConductorPiece geometry starts at the `structure_endpoint` (on the assembly). Use point-to-point `measure_distance(structure_endpoint, inline_endpoint)` for insulator length instead.
- **`measure_distance(assembly, point)` returns null**: This combination isn't supported. Use point-to-point or assembly-to-ConductorPiece instead.
- **`<` operator doesn't work on Labels**: Can't compare Label types with `<` for ordering. Use `=` for equality checks only.
- **Unit values in string concatenation**: `& unit_value` produces blank output. Divide by `unit_value(1, "unit")` to get a dimensionless number before concatenating.
