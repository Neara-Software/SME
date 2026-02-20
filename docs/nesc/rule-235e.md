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

**Implemented:** Category 3 (support arms, braces)

**Not yet implemented:** Categories 1, 2, 4, 5

## Architecture

The implementation follows a **bijective** mapping to NESC rules — each sub-rule maps to prefixed fields within the Processing class, not separate helper types. It uses a per-span Processing pattern (same as Rule 234B).

### Data Flow

```
Pole
  u_rule235e_processing    ← broadcasts over spans, aggregates violations
  u_rule235e_output        ← instantiates Calculator, returns pass/fail

ClearanceRule235EProcessing  (per-span)
  cat3_*                   ← Category 3 fields
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

For each assembly at the pole, `measure_distance(assembly, span.Environments[].Cables).distance` is compared against `cat3_required_clearance`. If actual < required, a violation record is emitted.

### Pole-Level Aggregation

The Pole extension broadcasts over all spans, collecting violations via two separate `broadcast()` calls (to avoid the dim module-prefix bug with `[]` on let variables):
- `flatten(broadcast(s: spans, ...output.violations))`
- `max(broadcast(s: spans, ...output.cat3_required_clearance))`

## Known Limitations

- **Grounded vs ungrounded assemblies**: `AssemblyType.u_is_grounded` field exists but is not yet used. Category 4a/4b distinction requires this.
- **Self-attachment**: No filtering for a conductor's own crossarm — a conductor attached to a crossarm will be checked against that same crossarm.
- **Joint-use comm distinction**: Comm cables use sentinel `-3kV` (general). Joint-use comm (`-2kV`) is not yet distinguished.
- **Assembly filtering**: All assemblies are checked. Non-structural components that shouldn't be checked are not yet excluded.

## Adding New Categories

To add a new NESC 235-6 category (e.g., Category 4 — structure surface):

1. Add `cat4_` prefixed fields to `ClearanceRule235EProcessing`:
   - `cat4_span_voltage` — voltage lookup (may reuse `cat3_span_voltage` pattern)
   - `cat4_required_clearance` — DataTable lookup with `nesccategory = 4` and appropriate subcategory filter
   - `cat4_violations` — measurement + comparison logic
2. Add `cat4_violations` to the `violations` field (merge with existing categories)
3. Add `cat4_required_clearance` to `output` if needed for debugging
4. Update Pole extension aggregation to include the new output fields
5. The DataTable already contains all category rows — no data changes needed

## dim Language Gotchas Encountered

These are specific to this implementation and may help when extending it:

- **Module prefix on `[]` operator**: `let_var[].field` inside a module context resolves `let_var` as `nesc~let_var`. Workaround: chain directly from `broadcast()` into `.output.field` instead of storing intermediate results.
- **Module prefix on `span.section.voltage`**: Inside `let()` expressions, `voltage` gets prefixed to `nesc~voltage`. Workaround: extract into a standalone formula field (`cat3_span_voltage`).
- **Unit arithmetic**: dim can't represent compound units like `in/kV`. Divide voltage difference by `unit_value(1, "kV")` to make it dimensionless, so `in * dimensionless = in`.
- **DataTable field aliases**: Platform normalizes aliases to lowercase-no-underscores (e.g., `min_voltage_kv` becomes `minvoltagekv`). Use the normalized form in formulas.
