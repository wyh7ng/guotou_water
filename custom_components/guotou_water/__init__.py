"""The SQZLS Water integration."""
from __future__ import annotations

import asyncio
import datetime
import logging
import pathlib
from datetime import timedelta

import aiohttp
from async_timeout import timeout

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig

from .const import (
    DOMAIN,
    CONF_HOUSE_ID,
    CONF_UPDATE_INTERVAL,
    DEFAULT_UPDATE_INTERVAL,
    API_BASE_URL,
    API_HOUSE_URL,
    COORDINATOR,
    UNDO_UPDATE_LISTENER,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]


CARD_URL = "/guotou_water/water-info-card.js"
CARD_REGISTERED_KEY = f"{DOMAIN}_card_registered"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Guotou Water component."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up SQZLS Water from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # 自动注册前端卡片资源
    if not hass.data.get(CARD_REGISTERED_KEY):
        card_path = pathlib.Path(__file__).parent / "www" / "water-info-card.js"
        if card_path.exists():
            await hass.http.async_register_static_paths([
                StaticPathConfig(CARD_URL, str(card_path), True)
            ])
            add_extra_js_url(hass, CARD_URL)
            hass.data[CARD_REGISTERED_KEY] = True
            _LOGGER.info("水务信息卡片已自动注册: %s", CARD_URL)

    house_id = entry.data[CONF_HOUSE_ID]
    update_interval = entry.options.get(CONF_UPDATE_INTERVAL, DEFAULT_UPDATE_INTERVAL)

    coordinator = SQZLSWaterDataUpdateCoordinator(
        hass, house_id, update_interval
    )

    await coordinator.async_config_entry_first_refresh()

    if not coordinator.last_update_success:
        raise ConfigEntryNotReady

    undo_listener = entry.add_update_listener(update_listener)

    hass.data[DOMAIN][entry.entry_id] = {
        COORDINATOR: coordinator,
        UNDO_UPDATE_LISTENER: undo_listener,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = all(
        await asyncio.gather(
            *[
                hass.config_entries.async_forward_entry_unload(entry, component)
                for component in PLATFORMS
            ]
        )
    )

    hass.data[DOMAIN][entry.entry_id][UNDO_UPDATE_LISTENER]()

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok


async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options update."""
    await hass.config_entries.async_reload(entry.entry_id)


class SQZLSWaterDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching SQZLS Water data."""

    def __init__(
        self,
        hass: HomeAssistant,
        house_id: str,
        update_interval_seconds: int,
    ):
        """Initialize the coordinator."""
        update_interval = timedelta(seconds=update_interval_seconds)
        _LOGGER.debug("Data will be updated every %s", update_interval)

        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=update_interval)

        self.house_id = house_id

    async def _async_update_data(self) -> dict:
        """Fetch data from SQZLS Water API."""
        try:
            async with timeout(60):
                return await self._fetch_water_data()
        except Exception as error:
            raise UpdateFailed(f"Error fetching data: {error}") from error

    async def _fetch_water_data(self) -> dict:
        """Fetch water usage data from the API."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }

        now = datetime.datetime.now()
        current_year = now.year
        current_month = now.month
        
        # Query from last year January to next month
        begin_month = f"{current_year - 1}-01-01"
        end_month = f"{current_year + 1}-01-31"

        result_data = {
            "current_reading": 0.0,
            "yearly_volume": 0.0,
            "yearly_amount": 0.0,
            "monthly_volume": 0.0,
            "monthly_amount": 0.0,
            "unpaid_amount": 0.0,
            "unit_price": 0.0,
            "balance": 0.0,
            "querytime": now.isoformat(),
            "house_id": self.house_id,
            # Historical data for charts and calendar display
            "monthly_history": [],
            # Meter information
            "meter_id": None,
            "cost_category": None,
            "customer_name": None,
            "address": None,
        }

        params = {
            "houseId": self.house_id,
            "params[beginMonth]": begin_month,
            "params[endMonth]": end_month,
        }

        connector = aiohttp.TCPConnector(limit=5)
        async with aiohttp.ClientSession(connector=connector) as session:
            try:
                async with session.get(
                    API_BASE_URL,
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        json_data = await response.json()
                        
                        if json_data.get("code") == 200:
                            rows = json_data.get("rows", [])
                            
                            if rows:
                                # Sort by month descending to get latest first
                                rows_sorted = sorted(rows, key=lambda x: x.get("month", ""), reverse=True)
                                
                                # Get latest record for current reading and meter info
                                latest = rows_sorted[0]
                                result_data["current_reading"] = float(latest.get("meterIndex", 0) or 0)
                                result_data["meter_id"] = latest.get("meterId")
                                result_data["cost_category"] = latest.get("costCategoryName")
                                result_data["unit_price"] = float(latest.get("unitPrice", 0) or 0)
                                
                                # Calculate yearly totals (current year)
                                yearly_vol = 0.0
                                yearly_amt = 0.0
                                unpaid_total = 0.0
                                monthly_history = []
                                
                                for row in rows:
                                    month_str = row.get("month", "")
                                    quantity = float(row.get("quantity", 0) or 0)
                                    amount = float(row.get("amount", 0) or 0)
                                    payable = float(row.get("payableAmount", 0) or 0)
                                    paid = float(row.get("paidAmount", 0) or 0)
                                    is_paid = row.get("isPaid", True)
                                    
                                    # Check if this month is in current year
                                    if month_str.startswith(str(current_year)):
                                        yearly_vol += quantity
                                        yearly_amt += amount
                                    
                                    # Check unpaid
                                    if not is_paid:
                                        unpaid_total += (payable - paid)
                                    
                                    # Build monthly history
                                    if month_str and quantity > 0:
                                        monthly_history.append({
                                            "date": month_str,
                                            "volume": round(quantity, 2),
                                            "amount": round(amount, 2),
                                            "reading": float(row.get("meterIndex", 0) or 0),
                                            "last_reading": float(row.get("lastMeterIndex", 0) or 0),
                                            "unit_price": float(row.get("unitPrice", 0) or 0),
                                            "is_paid": is_paid,
                                        })
                                
                                result_data["yearly_volume"] = round(yearly_vol, 2)
                                result_data["yearly_amount"] = round(yearly_amt, 2)
                                result_data["unpaid_amount"] = round(unpaid_total, 2)
                                
                                # Get current month data
                                current_month_str = f"{current_year}-{current_month:02d}-01"
                                for row in rows:
                                    if row.get("month", "") == current_month_str:
                                        result_data["monthly_volume"] = round(float(row.get("quantity", 0) or 0), 2)
                                        result_data["monthly_amount"] = round(float(row.get("amount", 0) or 0), 2)
                                        break
                                
                                # Sort history by date
                                monthly_history.sort(key=lambda x: x["date"])
                                result_data["monthly_history"] = monthly_history
                                
            except asyncio.TimeoutError:
                _LOGGER.warning("Timeout fetching water data")
            except Exception as e:
                _LOGGER.warning("Error fetching water data: %s", e)
                raise

            # Fetch balance from house info API
            try:
                house_url = API_HOUSE_URL.format(house_id=self.house_id)
                async with session.get(
                    house_url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        json_data = await response.json()
                        if json_data.get("code") == 200:
                            data = json_data.get("data", {})
                            customer = data.get("customer", {})
                            result_data["balance"] = float(customer.get("balance", 0) or 0)
                            result_data["customer_name"] = data.get("name", "")
                            result_data["address"] = data.get("address", "")
            except Exception as e:
                _LOGGER.warning("Error fetching balance data: %s", e)

        return result_data
