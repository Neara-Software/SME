"""Data models for cable constructions and installations."""

from pydantic import BaseModel, Field


class ConductorLayer(BaseModel):
    """Cable conductor properties."""

    material: str = Field(description="Conductor material (Cu or Al)")
    cross_section_mm2: float = Field(gt=0, description="Cross-sectional area in mm²")
    diameter_mm: float = Field(gt=0, description="Outer diameter in mm")
    resistivity_20c: float = Field(
        gt=0, description="DC resistivity at 20°C in Ω·m", default=1.7241e-8
    )
    temperature_coefficient: float = Field(
        gt=0, description="Resistance temperature coefficient at 20°C per K", default=3.93e-3
    )


class InsulationLayer(BaseModel):
    """Cable insulation properties."""

    material: str = Field(description="Insulation material (XLPE, EPR, paper, etc.)")
    inner_diameter_mm: float = Field(gt=0)
    outer_diameter_mm: float = Field(gt=0)
    thermal_resistivity: float = Field(
        gt=0, description="Thermal resistivity in K·m/W", default=3.5
    )
    permittivity: float = Field(gt=0, description="Relative permittivity", default=2.5)
    tan_delta: float = Field(ge=0, description="Loss tangent", default=0.001)
    max_temperature_c: float = Field(description="Maximum operating temperature in °C", default=90)


class SheathLayer(BaseModel):
    """Cable metallic sheath/screen properties."""

    material: str = Field(description="Sheath material (lead, aluminium, copper)")
    inner_diameter_mm: float = Field(gt=0)
    outer_diameter_mm: float = Field(gt=0)
    resistivity_20c: float = Field(gt=0, description="DC resistivity at 20°C in Ω·m")


class ArmourLayer(BaseModel):
    """Cable armour properties."""

    material: str = Field(description="Armour material (steel, aluminium)")
    wire_diameter_mm: float = Field(gt=0, description="Individual wire diameter in mm")
    mean_diameter_mm: float = Field(gt=0, description="Mean diameter of armour in mm")
    resistivity_20c: float = Field(gt=0, description="DC resistivity at 20°C in Ω·m")


class JacketLayer(BaseModel):
    """Cable outer jacket/serving properties."""

    material: str = Field(description="Jacket material (PVC, PE, etc.)")
    inner_diameter_mm: float = Field(gt=0)
    outer_diameter_mm: float = Field(gt=0)
    thermal_resistivity: float = Field(gt=0, description="Thermal resistivity in K·m/W")


class CableConstruction(BaseModel):
    """Complete single-core or three-core cable construction."""

    name: str
    voltage_kv: float = Field(gt=0)
    num_cores: int = Field(ge=1, le=4)
    conductor: ConductorLayer
    insulation: InsulationLayer
    sheath: SheathLayer | None = None
    armour: ArmourLayer | None = None
    jacket: JacketLayer | None = None


class InstallationConfig(BaseModel):
    """Cable installation geometry and soil parameters."""

    burial_depth_m: float = Field(gt=0, description="Depth to cable centre in metres")
    spacing_m: float = Field(ge=0, description="Centre-to-centre spacing between cables in metres")
    num_circuits: int = Field(ge=1, default=1)
    arrangement: str = Field(
        description="Cable arrangement: flat, trefoil, etc.", default="flat"
    )
    soil_thermal_resistivity: float = Field(
        gt=0, description="Native soil thermal resistivity in K·m/W", default=1.0
    )
    ambient_temperature_c: float = Field(
        description="Ambient soil temperature in °C", default=15.0
    )
    backfill_thermal_resistivity: float | None = Field(
        default=None, description="Backfill thermal resistivity in K·m/W if different from soil"
    )


class CymcapResult(BaseModel):
    """Stored CYMCAP computed result for comparison/validation."""

    cable_name: str
    continuous_rating_a: float | None = None
    emergency_rating_a: float | None = None
    cyclic_rating_factor: float | None = None
    max_conductor_temp_c: float | None = None
