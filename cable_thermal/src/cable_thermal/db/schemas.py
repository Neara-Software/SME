"""Database table mappings and validation for CYMCAP Access databases.

CYMCAP stores cable data in Microsoft Access databases with tables for
cable constructions, installation configurations, and computed results.
This module defines the expected table structures and provides validation.
"""

# Known CYMCAP table names — these may vary by version.
# Actual table discovery is done dynamically in access_reader.py.
EXPECTED_TABLES = [
    "CableData",
    "ConductorData",
    "InsulationData",
    "SheathData",
    "ArmourData",
    "InstallationData",
    "Results",
]

# Column mappings: CYMCAP column name → our model field name
CONDUCTOR_COLUMNS = {
    "Material": "material",
    "CrossSection": "cross_section_mm2",
    "Diameter": "diameter_mm",
    "Resistivity20": "resistivity_20c",
    "TempCoeff": "temperature_coefficient",
}

INSULATION_COLUMNS = {
    "Material": "material",
    "InnerDiameter": "inner_diameter_mm",
    "OuterDiameter": "outer_diameter_mm",
    "ThermalResistivity": "thermal_resistivity",
    "Permittivity": "permittivity",
    "TanDelta": "tan_delta",
    "MaxTemp": "max_temperature_c",
}

INSTALLATION_COLUMNS = {
    "BurialDepth": "burial_depth_m",
    "Spacing": "spacing_m",
    "NumCircuits": "num_circuits",
    "Arrangement": "arrangement",
    "SoilThermalResistivity": "soil_thermal_resistivity",
    "AmbientTemp": "ambient_temperature_c",
}
