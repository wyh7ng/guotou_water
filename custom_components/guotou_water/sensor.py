"""Sensor platform for SQZLS Water integration."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import MATCH_ALL
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import COORDINATOR, DOMAIN, SENSOR_TYPES, HISTORY_SENSOR_TYPE

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up SQZLS Water sensor entities from a config entry."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id][COORDINATOR]

    sensors = []
    # Normal sensors
    for sensor_type in SENSOR_TYPES:
        sensors.append(SQZLSWaterSensor(sensor_type, coordinator))
    
    # History sensor (stores full historical data, attributes excluded from recorder)
    sensors.append(SQZLSWaterHistorySensor(coordinator))

    async_add_entities(sensors, False)


class SQZLSWaterSensor(CoordinatorEntity, SensorEntity):
    """Define a SQZLS Water sensor entity."""

    _attr_has_entity_name = True

    def __init__(self, kind: str, coordinator) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._kind = kind
        self._attr_unique_id = f"{DOMAIN}_{kind}_{coordinator.house_id}"
        # Set fixed entity_id (English format)
        self.entity_id = f"sensor.guotou_water_{kind}"

    @property
    def name(self) -> str:
        """Return the name of the sensor."""
        return SENSOR_TYPES[self._kind]["name"]

    @property
    def device_info(self):
        """Return device information."""
        return {
            "identifiers": {(DOMAIN, self.coordinator.house_id)},
            "name": "国投水务水表",
            "manufacturer": "国投水务",
            "model": "智能水表",
        }

    @property
    def native_value(self):
        """Return the state of the sensor."""
        if self.coordinator.data:
            return self.coordinator.data.get(self._kind)
        return None

    @property
    def icon(self) -> str:
        """Return the icon of the sensor."""
        return SENSOR_TYPES[self._kind]["icon"]

    @property
    def native_unit_of_measurement(self) -> str | None:
        """Return the unit of measurement."""
        return SENSOR_TYPES[self._kind].get("unit_of_measurement")

    @property
    def device_class(self) -> str | None:
        """Return the device class."""
        return SENSOR_TYPES[self._kind].get("device_class")

    @property
    def extra_state_attributes(self) -> dict:
        """Return the state attributes (limited to avoid 16KB recorder limit)."""
        attrs = {}
        if self.coordinator.data:
            attrs["querytime"] = self.coordinator.data.get("querytime")
            attrs["house_id"] = self.coordinator.data.get("house_id")
            
            # Add extra info for current_reading sensor
            if self._kind == "current_reading":
                attrs["meter_id"] = self.coordinator.data.get("meter_id")
                attrs["cost_category"] = self.coordinator.data.get("cost_category")
        return attrs


class SQZLSWaterHistorySensor(CoordinatorEntity, SensorEntity):
    """Define a SQZLS Water history sensor entity.
    
    This sensor stores full historical data in attributes.
    The _unrecorded_attributes setting prevents these large attributes
    from being stored in the recorder database.
    """

    _attr_has_entity_name = True
    
    # Tell Home Assistant these attributes should not be recorded to database
    # Use MATCH_ALL to exclude all attributes from recording
    _unrecorded_attributes = frozenset({MATCH_ALL})

    def __init__(self, coordinator) -> None:
        """Initialize the history sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{DOMAIN}_history_data_{coordinator.house_id}"
        self.entity_id = f"sensor.guotou_water_history_data"

    @property
    def name(self) -> str:
        """Return the name of the sensor."""
        return HISTORY_SENSOR_TYPE["history_data"]["name"]

    @property
    def device_info(self):
        """Return device information."""
        return {
            "identifiers": {(DOMAIN, self.coordinator.house_id)},
            "name": "国投水务水表",
            "manufacturer": "国投水务",
            "model": "智能水表",
        }

    @property
    def native_value(self):
        """Return the state of the sensor (count of history records)."""
        if self.coordinator.data:
            monthly = len(self.coordinator.data.get("monthly_history", []))
            return f"{monthly}月"
        return "0月"

    @property
    def icon(self) -> str:
        """Return the icon of the sensor."""
        return HISTORY_SENSOR_TYPE["history_data"]["icon"]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes with FULL historical data."""
        attrs: dict[str, Any] = {}
        if self.coordinator.data:
            attrs["querytime"] = self.coordinator.data.get("querytime")
            attrs["house_id"] = self.coordinator.data.get("house_id")
            # Store complete historical data (for calendar and charts)
            attrs["monthly_history"] = self.coordinator.data.get("monthly_history", [])
        return attrs
