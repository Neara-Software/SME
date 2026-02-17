"""Tests for cable construction data models."""

from cable_thermal.db.models import (
    CableConstruction,
    ConductorLayer,
    InsulationLayer,
    InstallationConfig,
    SheathLayer,
)


def test_conductor_layer_defaults():
    conductor = ConductorLayer(
        material="Cu",
        cross_section_mm2=630,
        diameter_mm=29.3,
    )
    assert conductor.resistivity_20c == 1.7241e-8
    assert conductor.temperature_coefficient == 3.93e-3


def test_cable_construction_minimal():
    cable = CableConstruction(
        name="Test 132kV XLPE",
        voltage_kv=132,
        num_cores=1,
        conductor=ConductorLayer(
            material="Cu",
            cross_section_mm2=630,
            diameter_mm=29.3,
        ),
        insulation=InsulationLayer(
            material="XLPE",
            inner_diameter_mm=31.3,
            outer_diameter_mm=59.3,
        ),
    )
    assert cable.name == "Test 132kV XLPE"
    assert cable.sheath is None
    assert cable.armour is None


def test_cable_construction_with_sheath():
    cable = CableConstruction(
        name="Test 132kV XLPE with sheath",
        voltage_kv=132,
        num_cores=1,
        conductor=ConductorLayer(
            material="Cu",
            cross_section_mm2=630,
            diameter_mm=29.3,
        ),
        insulation=InsulationLayer(
            material="XLPE",
            inner_diameter_mm=31.3,
            outer_diameter_mm=59.3,
        ),
        sheath=SheathLayer(
            material="lead",
            inner_diameter_mm=60.0,
            outer_diameter_mm=64.0,
            resistivity_20c=21.4e-8,
        ),
    )
    assert cable.sheath is not None
    assert cable.sheath.material == "lead"


def test_installation_config_defaults():
    config = InstallationConfig(
        burial_depth_m=1.0,
        spacing_m=0.3,
    )
    assert config.soil_thermal_resistivity == 1.0
    assert config.ambient_temperature_c == 15.0
    assert config.arrangement == "flat"
    assert config.num_circuits == 1
