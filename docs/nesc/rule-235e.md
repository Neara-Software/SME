# NESC Rule 235E — Clearances at Fixed Supports

## What This Rule Checks

NESC Rule 235E1 specifies minimum clearances between conductors and structural parts of their supports (crossarms, braces, pole surface). This is a **conductor-to-structure** check, not conductor-to-conductor.

Reference: NESC Table 235-6, which defines required clearances by category and voltage.

## NESC Table 235-6 Categories

| NescCategory | SubCategory | What It Covers |
|---|---|---|
| 1 | a | Conductors of the same circuit |
| 1 | b | Conductors of different circuits |
| 2 | — | Guys, span wires, messengers, surge-protection wires |
| 3 | — | **Support arms, braces** (currently implemented) |
| 4 | a | Structure surface — ungrounded parts |
| 4 | b | Structure surface — grounded / neutral parts |
| 5 | a | Buildings, signs, billboards — horizontal |
| 5 | b | Buildings, signs, billboards — vertical |

## Current Implementation Status

| Category | Status |
|---|---|
| 2 — Guys, span wires, messengers | Implemented |
| 3 — Support arms, braces | Implemented |
| 4 — Structure surface | Stubbed (blocked on shaft-only measurement) |
| 1a/1b — Same/different circuit conductors | Not started |
| 5a/5b — Buildings, signs | Not started |

## Architecture

The implementation follows a **bijective** mapping to NESC rules — each sub-rule maps to prefixed fields within the Processing class, not separate helper types. It uses a per-span Processing pattern (same as Rule 234B).

### Data Flow

```
Pole
  u_rule235e_processing    ← broadcasts over spans, aggregates violations
  u_rule235e_output        ← instantiates Calculator, returns pass/fail

ClearanceRule235EProcessing  (per-span)
  cat2_*                   ← Category 2 fields (guys/stays)
  cat3_*                   ← Category 3 fields (support arms)
  cat4_*                   ← Category 4 fields (structure surface — stubbed)
  violations               ← flatten(list(cat2, cat3, cat4))
  output                   ← {cat3_required_clearance, has_violations, num_violations, violations}

ClearanceRule235ECalculator
  passes                   ← ["✅"] or ["❌ N clearance violation(s)"]
  output                   ← {pass, debug: {cat3_required_clearance, violations}}
```

### Files

| File | Purpose |
|---|---|
| `nesc/Types/nesc~ClearanceRule235EProcessing.neara.hjson` | Per-span clearance logic. Checks each assembly against each conductor. |
| `nesc/Types/nesc~ClearanceRule235ECalculator.neara.hjson` | Aggregates Processing output into pass/fail + debug info. |
| `nesc/Types/Pole.neara.hjson` | Pole extension. `u_rule235e_processing` broadcasts over spans. `u_rule235e_output` is the final result. |
| `nesc/DataTables/nesc~Table235_6.neara.hjson` | Encodes NESC Table 235-6 as a DataTable with all 5 categories. |
| `nesc/Reports/nesc~NESC 235E.neara.hjson` | Report showing `u_rule235e_output` per pole. |

## Category 2 Implementation Detail

**Guys, span wires, messengers, surge-protection wires.**

Checks clearance from each conductor to each stay/guy wire at the pole.

### Fields

- `cat2_conductor_class` — `span.section.type.conductor_class`
- `cat2_span_voltage` — maps Comms to `-3kV` sentinel, otherwise `span.section.voltage`
- `cat2_required_clearance` — Table 235-6 lookup with `nesccategory = 2`
- `cat2_violations` — broadcasts over `pole.Stays`, measures `measure_distance(stay, span.Environments[].Cables).distance`

### Violation Record

```
{ rule, category: "2", description: "Guy/stay clearance", span, component, required, actual }
```

### Notes

- `pole.Stays` is a built-in collection — no extension needed
- If a pole has no stays, the broadcast produces an empty list (no violations)
- Violation records use `component` (not `stay` or `assembly`) so all categories share the same record shape for `list()`/`flatten()` compatibility

## Category 3 Implementation Detail

### Clearance Formula

```
required = BaseClearanceIn + AdderPerKvIn * max(0, (voltage - AdderThresholdKv) / unit_value(1, "kV"))
```

- `BaseClearanceIn` — base clearance in inches from Table 235-6
- `AdderPerKvIn` — additional inches per kV above threshold (unit: "in", dimensionless multiplier via `/ unit_value(1, "kV")`)
- `AdderThresholdKv` — voltage above which adder applies

### Voltage Lookup

- Power conductors: uses `span.section.voltage` directly
- Communication cables: identified by `conductor_class = "Comms"`, mapped to sentinel value `-3kV` for DataTable lookup

### Violation Check

For each assembly at the pole, `measure_distance(assembly, span.Environments[].Cables).distance` is compared against `cat3_required_clearance`. If actual < required, a violation record is emitted:

```
{ rule, category: "3", description: "Support arms clearance", span, component, required, actual }
```

### Pole-Level Aggregation

The Pole extension broadcasts over all spans, collecting violations via two separate `broadcast()` calls (to avoid the dim module-prefix bug with `[]` on let variables):
- `flatten(broadcast(s: spans, ...output.violations))`
- `max(broadcast(s: spans, ...output.cat3_required_clearance))`

## Category 4 — Structure Surface (Stubbed)

**Ungrounded (4a) and grounded (4b) parts of the pole body.**

This category checks clearance from conductors to the physical pole shaft. It is **not yet implemented** because `measure_distance(pole, cables)` returns the distance to the entire structure (shaft + assemblies), which overlaps with Category 3.

### Blocker

Need a way to measure distance to the pole shaft only (e.g., `pole.Shaft` or a shaft-only geometry accessor). Until then, `cat4_violations` returns `[]` (always passes).

### When Unblocked

- Add `cat4_span_voltage`, `cat4_required_clearance` (same pattern as cat2/cat3)
- Use subcategory filter: `nesccategory = 4` with `subcategory = "a"` (ungrounded) or `"b"` (grounded)
- Requires `AssemblyType.u_is_grounded` (already exists) or a pole-level grounded flag to distinguish 4a vs 4b
- Expected clearances: 4a = 5in base, 4b = 3in base (0–8.7kV)

## Known Limitations

- **Grounded vs ungrounded assemblies**: `AssemblyType.u_is_grounded` field exists but is not yet used. Category 4a/4b distinction requires this.
- **Self-attachment**: No filtering for a conductor's own crossarm — a conductor attached to a crossarm will be checked against that same crossarm.
- **Joint-use comm distinction**: Comm cables use sentinel `-3kV` (general). Joint-use comm (`-2kV`) is not yet distinguished.
- **Assembly filtering**: All assemblies are checked. Non-structural components that shouldn't be checked are not yet excluded.

## Adding New Categories

To add a new NESC 235-6 category (e.g., Category 1 — conductor-to-conductor):

1. Add `cat1_` prefixed fields to `ClearanceRule235EProcessing`:
   - `cat1_span_voltage` — voltage lookup
   - `cat1_required_clearance` — DataTable lookup with `nesccategory = 1` and subcategory filter
   - `cat1_violations` — measurement + comparison logic
2. **Violation record must match existing shape**: `{ rule, category, description, span, component, required, actual }` — use `component` for the measured-against element (not `assembly`, `stay`, etc.) so `list()` type-checking passes
3. Add `cat1_violations` to the `violations` formula: `flatten(list(cat1_violations, cat2_violations, ...))`
4. Add debug fields to `output` if needed
5. Update Pole extension aggregation to include new output fields
6. The DataTable already contains all category rows — no data changes needed

## dim Language Gotchas Encountered

These are specific to this implementation and may help when extending it:

- **Module prefix on `[]` operator**: `let_var[].field` inside a module context resolves `let_var` as `nesc~let_var`. Workaround: chain directly from `broadcast()` into `.output.field` instead of storing intermediate results.
- **Module prefix on `span.section.voltage`**: Inside `let()` expressions, `voltage` gets prefixed to `nesc~voltage`. Workaround: extract into a standalone formula field (`cat3_span_voltage`).
- **Unit arithmetic**: dim can't represent compound units like `in/kV`. Divide voltage difference by `unit_value(1, "kV")` to make it dimensionless, so `in * dimensionless = in`.
- **DataTable field aliases**: Platform normalizes aliases to lowercase-no-underscores (e.g., `min_voltage_kv` becomes `minvoltagekv`). Use the normalized form in formulas.
- **`list()` requires matching types**: All violation records passed to `list()` must have identical field names and types. Use a common field like `component` instead of category-specific names (`assembly`, `stay`). `concat()` is element-wise string concatenation, not list merging — use `flatten(list(...))` instead.
