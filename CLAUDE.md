# HEDNO Power Line Design Application

Built in **dim**, a functional language with many footguns. Detailed patterns and examples: `docs/dim_language_practices.md`

## Dim CLI

```bash
dim sync --module pyth --path /Users/julianotto/Projects/delivery_hedno/pyth --types all  # or specific: --types Type1 Type2
dim analyze --module pyth 2>&1 | python3 scripts/dim_analyze_filter.py
dim docs function <name>              # Look up ANY function you haven't seen used
dim eval --code "<code>"              # Evaluate dim code on the Model
dim logs [filter] [-t seconds]        # Stream console logs from webapp
dim export <reportName> [--output <file>]
```

### Sync Gotcha

`--types` takes **space-separated variadic args** — not comma-separated, not quoted:
```bash
# CORRECT
dim sync --module pyth --path /Users/julianotto/Projects/delivery_hedno/pyth --types StudyUi _~Pole AssembloidDetermination
# WRONG: --types StudyUi,_~Pole    WRONG: --types "StudyUi _~Pole"
```

### Compile Check Workflow

**Always sync before analyze. Never claim changes are complete without running both.**
```bash
dim sync --module pyth --path /Users/julianotto/Projects/delivery_hedno/pyth --types <modified types>
dim analyze --module pyth 2>&1 | python3 scripts/dim_analyze_filter.py
```

## .dim Language Rules

**`u_` prefix required** in class extension files (`_~Pole.dim`, `_~Model.dim`, etc.). Fields without `u_` fail at runtime: `"field_name does not start with u_"`. Regular class files don't need it.

**`type_only()` null gotcha**: When calling `make_immutable_record`, explicitly pass `null` for any unpopulated field that uses `type_only()` as its formula, or you get `type_only: cannot evaluate type-only expression`.

**`make_immutable_record` DI**: You can override ANY formula (not just primitive fields) to inject pre-computed values and skip expensive calculations.

**Formula ownership**: Logic should live with the data it operates on. If "X has Y" sounds natural, Y belongs on X. See `docs/dim_language_practices.md` for detailed tests and examples.

**Alphabetical ordering**: Write fields and formulas in alphabetical order in `.dim` files to minimise merge conflicts.

## Debugging

`debug_trace("[PREFIX] context|key=" & value, do())` — second arg must be `do()`. Use `[BRACKETED_PREFIX]` for filtering console output. Remove traces before committing.

## Workflow Rules

1. **Commit often** — small commits, push to main. Don't leave unstaged work.
2. **Rebase on main** — ask user first. Resolve merge conflicts when rebasing.
