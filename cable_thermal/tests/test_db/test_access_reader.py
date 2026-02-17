"""Tests for Access database reader.

These tests require a CYMCAP Access database file.
Tests are skipped if no database is available.
"""

import pytest

from cable_thermal.db.access_reader import connect


def test_connect_file_not_found():
    with pytest.raises(FileNotFoundError, match="Database not found"):
        connect("nonexistent.accdb")
