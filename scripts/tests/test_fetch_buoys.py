"""
Tests for fetch-buoys.py

Tests the validation logic and data parsing functions.
"""

import sys
import os

# Add parent directory to path to import from fetch-buoys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import functions from fetch-buoys.py
# Note: We need to make the imports work by importing the module
import importlib.util
spec = importlib.util.spec_from_file_location("fetch_buoys",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fetch-buoys.py"))
fetch_buoys = importlib.util.module_from_spec(spec)

# Load the module to get access to functions
exec(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fetch-buoys.py")).read())


class TestParseFloat:
    """Tests for parse_float function"""

    def test_valid_float(self):
        assert parse_float("1.5") == 1.5
        assert parse_float("0.0") == 0.0
        assert parse_float("-10.5") == -10.5

    def test_missing_marker(self):
        assert parse_float("MM") is None
        assert parse_float("") is None
        assert parse_float(None) is None

    def test_invalid_string(self):
        assert parse_float("abc") is None
        assert parse_float("--") is None


class TestParseInt:
    """Tests for parse_int function"""

    def test_valid_int(self):
        assert parse_int("10") == 10
        assert parse_int("0") == 0
        assert parse_int("-5") == -5

    def test_float_to_int(self):
        assert parse_int("10.5") == 10
        assert parse_int("10.9") == 10

    def test_missing_marker(self):
        assert parse_int("MM") is None
        assert parse_int("") is None
        assert parse_int(None) is None


class TestValidateValue:
    """Tests for validate_value function (Issue #15)"""

    def test_valid_wave_height(self):
        """Wave height should be between 0-30m"""
        assert validate_value(1.5, 'wave_height') == 1.5
        assert validate_value(0.0, 'wave_height') == 0.0
        assert validate_value(10.0, 'wave_height') == 10.0
        assert validate_value(30.0, 'wave_height') == 30.0

    def test_invalid_wave_height(self):
        """Out of range wave heights should be rejected"""
        assert validate_value(-1.0, 'wave_height') is None
        assert validate_value(35.0, 'wave_height') is None
        assert validate_value(100.0, 'wave_height') is None

    def test_valid_dominant_period(self):
        """Dominant period should be between 1-30s"""
        assert validate_value(10.0, 'dominant_period') == 10.0
        assert validate_value(1.0, 'dominant_period') == 1.0
        assert validate_value(25.0, 'dominant_period') == 25.0

    def test_invalid_dominant_period(self):
        """Out of range periods should be rejected"""
        assert validate_value(0.5, 'dominant_period') is None
        assert validate_value(35.0, 'dominant_period') is None

    def test_valid_wave_direction(self):
        """Wave direction should be between 0-360 degrees"""
        assert validate_value(0, 'wave_direction') == 0
        assert validate_value(180, 'wave_direction') == 180
        assert validate_value(360, 'wave_direction') == 360

    def test_invalid_wave_direction(self):
        """Out of range directions should be rejected"""
        assert validate_value(-10, 'wave_direction') is None
        assert validate_value(400, 'wave_direction') is None

    def test_valid_wind_speed(self):
        """Wind speed should be between 0-100 m/s"""
        assert validate_value(5.0, 'wind_speed') == 5.0
        assert validate_value(0.0, 'wind_speed') == 0.0
        assert validate_value(50.0, 'wind_speed') == 50.0

    def test_invalid_wind_speed(self):
        """Out of range wind speeds should be rejected"""
        assert validate_value(-5.0, 'wind_speed') is None
        assert validate_value(150.0, 'wind_speed') is None

    def test_valid_water_temp(self):
        """Water temp should be between -5 to 40°C"""
        assert validate_value(20.0, 'water_temp') == 20.0
        assert validate_value(-5.0, 'water_temp') == -5.0
        assert validate_value(35.0, 'water_temp') == 35.0

    def test_invalid_water_temp(self):
        """Out of range water temps should be rejected"""
        assert validate_value(-10.0, 'water_temp') is None
        assert validate_value(50.0, 'water_temp') is None

    def test_valid_pressure(self):
        """Pressure should be between 850-1100 hPa"""
        assert validate_value(1013.0, 'pressure') == 1013.0
        assert validate_value(900.0, 'pressure') == 900.0
        assert validate_value(1050.0, 'pressure') == 1050.0

    def test_invalid_pressure(self):
        """Out of range pressures should be rejected"""
        assert validate_value(800.0, 'pressure') is None
        assert validate_value(1200.0, 'pressure') is None

    def test_none_value(self):
        """None values should pass through as None"""
        assert validate_value(None, 'wave_height') is None
        assert validate_value(None, 'wind_speed') is None

    def test_unknown_field(self):
        """Unknown fields should pass through unvalidated"""
        assert validate_value(9999, 'unknown_field') == 9999


class TestValidRanges:
    """Tests for VALID_RANGES configuration"""

    def test_all_expected_fields_defined(self):
        """All expected marine weather fields should have ranges"""
        expected_fields = [
            'wave_height', 'dominant_period', 'average_period',
            'wave_direction', 'wind_speed', 'wind_direction',
            'wind_gust', 'water_temp', 'air_temp', 'pressure'
        ]
        for field in expected_fields:
            assert field in VALID_RANGES, f"Missing range for {field}"

    def test_ranges_are_tuples(self):
        """All ranges should be (min, max) tuples"""
        for field, range_tuple in VALID_RANGES.items():
            assert isinstance(range_tuple, tuple), f"{field} should be tuple"
            assert len(range_tuple) == 2, f"{field} should have 2 elements"
            assert range_tuple[0] <= range_tuple[1], f"{field} min > max"


if __name__ == '__main__':
    import pytest
    pytest.main([__file__, '-v'])
