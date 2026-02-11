"""Constants for SQZLS Water integration."""

DOMAIN = "guotou_water"

# Configuration keys
CONF_HOUSE_ID = "house_id"
CONF_UPDATE_INTERVAL = "update_interval"

# Default values - 2 hours
DEFAULT_UPDATE_INTERVAL = 7200  # 2 hours in seconds

# API
API_BASE_URL = "http://sqzls.com/api/market/bill/listByMonth"
API_HOUSE_URL = "http://sqzls.com/api/market/house/{house_id}"

# Coordinator key
COORDINATOR = "coordinator"
UNDO_UPDATE_LISTENER = "undo_update_listener"

# Sensor types (normal sensors with limited attributes for recorder)
SENSOR_TYPES = {
    "current_reading": {
        "name": "当前表读数",
        "icon": "mdi:gauge",
        "unit_of_measurement": "m³",
        "device_class": None,
    },
    "balance": {
        "name": "账户余额",
        "icon": "mdi:wallet",
        "unit_of_measurement": "元",
        "device_class": "monetary",
    },
    "yearly_volume": {
        "name": "本年用水量",
        "icon": "mdi:water",
        "unit_of_measurement": "m³",
        "device_class": "water",
    },
    "yearly_amount": {
        "name": "本年水费",
        "icon": "mdi:currency-cny",
        "unit_of_measurement": "元",
        "device_class": "monetary",
    },
    "monthly_volume": {
        "name": "本月用水量",
        "icon": "mdi:water",
        "unit_of_measurement": "m³",
        "device_class": "water",
    },
    "monthly_amount": {
        "name": "本月水费",
        "icon": "mdi:currency-cny",
        "unit_of_measurement": "元",
        "device_class": "monetary",
    },
    "unpaid_amount": {
        "name": "未缴金额",
        "icon": "mdi:currency-cny",
        "unit_of_measurement": "元",
        "device_class": "monetary",
    },
    "unit_price": {
        "name": "当前单价",
        "icon": "mdi:cash",
        "unit_of_measurement": "元/m³",
        "device_class": None,
    },
}

# History sensor type (excluded from recorder, stores full history)
HISTORY_SENSOR_TYPE = {
    "history_data": {
        "name": "历史数据",
        "icon": "mdi:chart-line",
        "unit_of_measurement": None,
        "device_class": None,
    },
}
