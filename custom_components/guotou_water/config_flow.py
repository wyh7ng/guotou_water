"""Config flow for SQZLS Water integration."""
from __future__ import annotations

import logging
import datetime
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntry, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import (
    DOMAIN,
    CONF_HOUSE_ID,
    CONF_UPDATE_INTERVAL,
    DEFAULT_UPDATE_INTERVAL,
    API_BASE_URL,
)

_LOGGER = logging.getLogger(__name__)


class SQZLSWaterConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for SQZLS Water."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            # Validate the credentials by making a test API call
            valid = await self._test_credentials(
                user_input[CONF_HOUSE_ID],
            )

            if valid:
                # Use house_id as unique id
                await self.async_set_unique_id(user_input[CONF_HOUSE_ID])
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title="国投水务",
                    data=user_input,
                )
            else:
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_HOUSE_ID): str,
                }
            ),
            errors=errors,
        )

    async def _test_credentials(self, house_id: str) -> bool:
        """Test if the credentials are valid."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }

        now = datetime.datetime.now()
        begin_month = f"{now.year}-01-01"
        end_month = f"{now.year}-12-31"

        params = {
            "houseId": house_id,
            "params[beginMonth]": begin_month,
            "params[endMonth]": end_month,
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(API_BASE_URL, headers=headers, params=params) as response:
                    if response.status == 200:
                        json_data = await response.json()
                        return json_data.get("code") == 200
        except Exception as e:
            _LOGGER.error("Error testing credentials: %s", e)

        return False

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Get the options flow for this handler."""
        return SQZLSWaterOptionsFlowHandler()


class SQZLSWaterOptionsFlowHandler(OptionsFlow):
    """Handle options flow for SQZLS Water."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_UPDATE_INTERVAL,
                        default=self.config_entry.options.get(
                            CONF_UPDATE_INTERVAL, DEFAULT_UPDATE_INTERVAL
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=300, max=86400)),
                }
            ),
        )
