# Underground Cable Thermal Rating — Project Plan

## Context

New greenfield Python project for calculating thermal ratings of underground power cables. The project will progress from data ingestion through analytical IEC calculations, benchmark validation, and ultimately to numerical FEM-based thermal modelling. Development is on an orphan branch (`underground-cable-thermal`) in the existing SME repo, completely independent of other work.

## Project Structure

```
cable_thermal/
├── pyproject.toml              # uv-managed, project metadata & dependencies
├── .python-version             # Pin Python version (3.12+)
├── README.md
├── CLAUDE.md                   # Project-specific AI instructions
├── src/
│   └── cable_thermal/
│       ├── __init__.py
│       ├── db/                 # Phase 1: CYMCAP ingestion
│       │   ├── __init__.py
│       │   ├── access_reader.py    # .mdb/.accdb reading via pyodbc
│       │   ├── models.py           # Data classes for cable constructions, installations
│       │   └── schemas.py          # DB table mappings / validation
│       ├── iec/                # Phases 2-3: IEC calculations
│       │   ├── __init__.py
│       │   ├── iec60287/           # Steady-state rating
│       │   │   ├── __init__.py
│       │   │   ├── conductor_losses.py
│       │   │   ├── dielectric_losses.py
│       │   │   ├── sheath_losses.py
│       │   │   ├── thermal_resistance.py
│       │   │   └── rating.py       # Top-level steady-state current rating
│       │   └── iec60853/           # Cyclic rating
│       │       ├── __init__.py
│       │       ├── transient.py
│       │       ├── cyclic_factors.py
│       │       └── rating.py
│       ├── reporting/          # Reporting & PDF output
│       │   ├── __init__.py
│       │   ├── templates/          # LaTeX Jinja2 templates
│       │   │   ├── iec60287_report.tex.j2
│       │   │   ├── iec60853_report.tex.j2
│       │   │   └── fem_results.tex.j2
│       │   ├── renderer.py         # LaTeX compilation & PDF generation
│       │   ├── calc_trace.py       # Captures formula + intermediate results
│       │   └── report.py           # High-level report generation API
│       ├── benchmarks/         # Phase 4: CIGRE validation
│       │   ├── __init__.py
│       │   ├── cigre_data.py       # Reference benchmark values
│       │   └── validation.py       # Comparison framework
│       └── fem/                # Phases 5-6: Numerical methods
│           ├── __init__.py
│           ├── mesh.py             # 2D/3D mesh generation
│           ├── thermal_2d.py       # 2D soil thermal resistivity
│           └── thermal_3d.py       # Full 3D cable thermal model
├── tests/
│   ├── test_db/
│   ├── test_iec60287/
│   ├── test_iec60853/
│   ├── test_reporting/
│   ├── test_benchmarks/
│   └── test_fem/
├── data/
│   └── sample/                 # Sample CYMCAP databases for testing
└── notebooks/                  # Jupyter notebooks for exploration / visualization
```

## Phased Implementation

### Phase 1 — CYMCAP Database Ingestion

**Goal:** Read Access (.mdb/.accdb) databases exported from CYMCAP, extract cable construction data, installation parameters, and computed results into Python data structures.

**Status:** Scaffolding complete. `access_reader.py` has `connect()`, `list_tables()`, `list_columns()`, `read_table()`. Pydantic models defined for all cable layers and installation config.

- **Dependencies:** `pyodbc` (Windows has native Access ODBC driver)
- **Steps:**
  1. ~~Set up project scaffolding (pyproject.toml, uv, src layout, pytest)~~ ✅
  2. Connect to a sample CYMCAP database and catalog all tables/columns
  3. ~~Define dataclasses/Pydantic models for cable constructions (conductor, insulation, sheath, armour, jacket), installation geometry (burial depth, spacing, backfill), and CYMCAP computed results~~ ✅
  4. ~~Build `access_reader.py` to load and validate data~~ ✅ (basic structure)
  5. Write tests with a sample database

**Remaining work:**
- Obtain a real CYMCAP database and refine column mappings in `schemas.py`
- Add higher-level functions in `access_reader.py` that return populated Pydantic models
- Integration tests against a real database file

---

### Phase 2 — IEC 60287 Steady-State Rating

**Goal:** Implement the full IEC 60287 series calculation for continuous current rating of underground cables.

**Key calculation components:**

#### Conductor losses (`conductor_losses.py`)
- DC resistance at operating temperature: R_dc = R_20 × [1 + α₂₀(θ - 20)]
- Skin effect factor (ys): based on xs² = (8πf / R_dc) × 10⁻⁷ × ks
- Proximity effect factor (yp): based on xp², conductor spacing, diameter
- AC resistance: R_ac = R_dc × (1 + ys + yp)

#### Dielectric losses (`dielectric_losses.py`)
- Capacitance per phase: C = ε / (18 × ln(Di/dc)) × 10⁻⁹ [F/m]
- Dielectric loss per phase: Wd = ωCU₀² × tan δ [W/m]

#### Sheath/screen losses (`sheath_losses.py`)
- Loss factor λ₁ = λ₁' + λ₁''
  - λ₁' — circulating current losses (depends on bonding: single-point, both-ends, cross-bonded)
  - λ₁'' — eddy current losses
- For single-core cables with single-point bonding: λ₁' = 0
- For solid bonding (both ends): λ₁' = (Rs/R) × 1/(1 + (Rs/X)²)
  - X = 2ωln(2s/d) × 10⁻⁷ [Ω/m]

#### Armour losses (included in `sheath_losses.py` or separate)
- Loss factor λ₂ for steel wire armour
- Depends on armour type (wire, tape) and cable configuration

#### Thermal resistances (`thermal_resistance.py`)
- **T₁** — Insulation thermal resistance: T₁ = (ρ_T / 2π) × ln(1 + 2t₁/dc)
- **T₂** — Bedding between sheath and armour: T₂ = (ρ_T / 2π) × ln(1 + 2t₂/Ds)
- **T₃** — External serving/jacket: T₃ = (ρ_T / 2π) × ln(1 + 2t₃/Da)
- **T₄** — Surrounding medium (soil):
  - Single cable: T₄ = (ρ_soil / 2π) × ln(2L/De + √((2L/De)² - 1))
  - With mutual heating: includes image source terms for adjacent cables

#### Current rating equation (`rating.py`)
```
I = √[(Δθ - Wd[0.5T₁ + n(T₂ + T₃ + T₄)]) / (R·T₁ + nR(1+λ₁)T₂ + nR(1+λ₁+λ₂)(T₃+T₄))]
```

Where:
- Δθ = θ_max - θ_ambient (permissible temperature rise)
- n = number of conductors in cable
- R = AC resistance of conductor at maximum operating temperature
- Wd = dielectric losses per phase

**Test strategy:**
- Unit tests for each sub-calculation with hand-calculated values
- Integration test: full rating calculation for a known cable type
- Cross-validate against CYMCAP results from Phase 1

---

### Phase 3 — IEC 60853 Cyclic Rating

**Goal:** Implement cyclic rating factors and transient thermal response per IEC 60853.

#### Transient thermal response (`transient.py`)
- Cable thermal response function based on thermal circuit (ladder network)
- Exponential integral functions: -Ei(-x) for soil transient response
- Soil transient response: θ_soil(t) = (Q / 4πk) × [-Ei(-D²/4αt)]
  - α = thermal diffusivity of soil = k/(ρ×c)

#### Cyclic rating factors (`cyclic_factors.py`)
- Daily load cycle characterization (24-hour load profile)
- Loss-load factor μ = (average losses) / (peak losses)
- Attainment factor: ratio of cyclic temperature rise to steady-state rise
- **M factor**: cyclic rating factor = I_cyclic / I_continuous
  - M = √(Δθ_ss / Δθ_cyclic) where Δθ_cyclic accounts for the load cycle

#### Cyclic rating calculation (`rating.py`)
- Apply M factor to steady-state rating from Phase 2
- I_cyclic = M × I_continuous
- Emergency rating: short-duration overload capacity
  - Based on transient thermal response and initial temperature
  - Time-limited (e.g., 6h, 24h, 72h emergency durations)

**Test strategy:**
- Validate transient response functions against analytical solutions
- Compare M factors against published IEC examples
- Emergency ratings against known cable data

---

### Reporting — PDF Calculation Reports

**Goal:** Generate professional PDF reports showing all IEC mathematical formulas with their computed values, providing a full audit trail of each ampacity calculation. FEM phases report summary results only.

**Approach:** Jinja2-templated LaTeX → PDF via `pdflatex` or `latexmk`.

#### Calculation trace system (`calc_trace.py`)
Each IEC calculation step records:
- The IEC clause reference (e.g., "IEC 60287-1-1, Eq. 2.1")
- The formula in LaTeX notation
- Input parameter names, symbols, and values
- The computed result with units

Example trace entry:
```python
@dataclass
class CalcStep:
    clause: str           # "IEC 60287-1-1, Eq. 2.1"
    description: str      # "DC resistance at maximum operating temperature"
    formula_latex: str    # r"R_{dc}(\theta) = R_{20} \times [1 + \alpha_{20}(\theta - 20)]"
    inputs: dict          # {"R_20": ("1.234e-5", "Ω/m"), "α_20": ("3.93e-3", "K⁻¹"), ...}
    result: tuple         # ("1.567e-5", "Ω/m")
```

#### LaTeX templates (`templates/`)
- Jinja2 `.tex.j2` templates that iterate over traced calculation steps
- Each formula rendered with `\begin{equation}` blocks
- Substituted values shown below each formula
- Professional formatting with `siunitx`, `booktabs`, `amsmath`

#### Reports:
- **IEC 60287 report** (`iec60287_report.tex.j2`): Full steady-state rating derivation — conductor losses through final ampacity, every intermediate value shown
- **IEC 60853 report** (`iec60853_report.tex.j2`): Cyclic rating factors, transient response parameters, M factor derivation
- **FEM results report** (`fem_results.tex.j2`): Summary tables and figures (temperature distributions, maximum temperatures) — no formula derivation needed

**Dependencies:** `jinja2`, LaTeX distribution (MiKTeX/TeX Live on Windows)

---

### Phase 4 — CIGRE Benchmark Validation

**Goal:** Validate Phases 2-3 against published CIGRE benchmark cases.

#### Reference data (`cigre_data.py`)
- Encode reference cases from CIGRE technical brochures:
  - TB 880 (Update of service experience of HV underground and submarine cable systems)
  - Electra publications with benchmark ampacity calculations
  - Standard cable configurations with known ratings
- Each benchmark case includes:
  - Cable construction parameters
  - Installation conditions
  - Published/calculated ampacity values
  - Source reference

#### Validation framework (`validation.py`)
- Automated comparison with tolerance thresholds
- Default tolerance: ±1% for thermal resistances, ±2% for current rating
- Generate validation report showing:
  - Parameter-by-parameter comparison
  - % deviation from reference
  - Pass/fail status per benchmark case
- Regression testing: run all benchmarks as part of CI

**Test strategy:**
- Each CIGRE benchmark as a parametrized pytest case
- Fail if deviation exceeds tolerance threshold
- Track historical deviations over time

---

### Phase 5 — 2D FEM Soil Thermal Resistivity

**Goal:** Solve 2D heat conduction in soil cross-sections using custom finite element methods.

#### Mesh generation (`mesh.py`)
- 2D mesh generation for cable trench cross-sections
- Support for:
  - Rectangular backfill zones
  - Circular cable/duct cross-sections
  - Multiple soil layers (horizontal boundaries)
  - Duct bank geometries
- Mesh refinement near heat sources (cables)
- Output: node coordinates, element connectivity, material assignments

#### 2D thermal solver (`thermal_2d.py`)
- Steady-state heat equation: ∇·(k∇T) = Q
- Finite element formulation:
  - Triangular elements with linear shape functions (simplest, start here)
  - Element stiffness matrix: Kᵉ = ∫ k(∇N)ᵀ(∇N) dA
  - Global assembly: KT = F
- Boundary conditions:
  - Isothermal ground surface: T(y=0) = T_ambient
  - Adiabatic far-field boundaries (or semi-infinite approximation)
  - Heat source: cable losses as volumetric or line sources
- Solver: SciPy sparse direct solver (`scipy.sparse.linalg.spsolve`)
- Handle multiple soil layers, backfill zones with different thermal resistivities
- Post-processing: extract cable surface temperatures, maximum temperatures

#### Validation
- Compare against analytical IEC T₄ for single buried cable
- Compare against IEC mutual heating corrections for multiple cables
- Convergence study: refine mesh and verify solution converges

**Dependencies:** `numpy`, `scipy` (sparse), optionally `meshpy` or `pygmsh` for mesh generation. Fall back to FEniCS/dolfinx if custom implementation proves insufficient.

---

### Phase 6 — 3D Cable Thermal Model

**Goal:** Full 3D transient thermal simulation of cable systems.

#### 3D mesh extension
- Extend 2D cross-section mesh along cable route (longitudinal direction)
- Variable element size along route (finer near joints, crossings)
- Support for:
  - Cable joints (different thermal properties, larger diameter)
  - Route transitions (e.g., depth changes, soil type changes)
  - Cable crossings (other cables/services)

#### 3D transient solver (`thermal_3d.py`)
- Transient heat equation: ρc(∂T/∂t) = ∇·(k∇T) + Q
- Time-stepping schemes:
  - Implicit Euler (first-order, unconditionally stable) — start here
  - Crank-Nicolson (second-order) — upgrade if accuracy needed
- At each time step solve: (M/Δt + K)Tⁿ⁺¹ = (M/Δt)Tⁿ + F
  - M = mass/capacitance matrix
  - K = stiffness/conductivity matrix
  - F = load vector (heat sources)
- Time-varying heat sources (load profiles from Phase 3)

#### Validation
- 3D steady-state should match 2D results (uniform cross-section, no joints)
- Transient response should match IEC 60853 analytical solutions for simple cases
- Joint hot-spot temperatures against published data

**Dependencies:** `numpy`, `scipy` (sparse), potentially `meshpy`/`pygmsh`, `matplotlib` for visualization. May require `fenics`/`dolfinx` for complex geometries.

---

## Dependencies Summary

### Phase 1 (current)
```toml
[project]
dependencies = [
    "pyodbc>=5.0",
    "pydantic>=2.0",
    "numpy>=1.26",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff", "mypy"]
notebooks = ["jupyter", "matplotlib"]
```

### Added in Phase 2-3
- `scipy` (for special functions like exponential integrals)

### Added for Reporting
- `jinja2` (LaTeX template rendering)
- System requirement: LaTeX distribution (MiKTeX or TeX Live)

### Added in Phase 5-6
- `scipy` (sparse solvers)
- `matplotlib` (visualization)
- `meshpy` or `pygmsh` (mesh generation — evaluate need)
- Potentially `fenics`/`dolfinx` (fallback for complex FEM)

---

## Development Workflow

- **Branch:** `underground-cable-thermal` (orphan branch, independent of main)
- **Package manager:** uv
- **Testing:** pytest, run with `uv run pytest`
- **Linting:** ruff (`uv run ruff check src/ tests/`)
- **Type checking:** mypy (`uv run mypy src/`)
- **Python version:** 3.12+
