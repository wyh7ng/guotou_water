# 国投水务 (Guotou Water) - Home Assistant 集成

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

Home Assistant 自定义集成，用于获取[国投水务](http://sqzls.com/)的用水数据和水费信息，并提供精美的 Lovelace 自定义卡片展示。

## 功能

- 📊 **用水数据** - 当前表读数、月度/年度用水量和水费
- 💰 **账户余额** - 实时余额查询
- 📅 **历史账单** - 月度用水历史记录和缴费状态
- 🎨 **自定义卡片** - 内置精美的水务信息卡片（概览、月用水图表、账单日历）

## 截图

### 概览视图
显示本月/本年用水量、水费，以及年度用水进度条。

### 月用水视图
以柱状图展示近12个月的用水趋势。

### 账单视图
月度账单日历，直观显示每月用水量、费用和缴费状态。

## 安装

### HACS 安装（推荐）

1. 确保已安装 [HACS](https://hacs.xyz/)
2. 点击 HACS → 集成 → 右上角三个点 → **自定义存储库**
3. 输入仓库地址，类别选择 **Integration**
4. 点击添加，然后搜索"国投水务"进行安装
5. 重启 Home Assistant

### 手动安装

1. 下载本仓库的 `custom_components/guotou_water` 目录
2. 复制到 Home Assistant 的 `custom_components/guotou_water` 目录
3. 将 `custom_components/guotou_water/www/water-info-card.js` 复制到 `www/` 目录
4. 重启 Home Assistant

## 配置

### 添加集成

1. 进入 Home Assistant → 设置 → 设备与服务 → 添加集成
2. 搜索"国投水务"
3. 输入以下信息：
   - **户号 (houseId)**: 水务户号

### 添加自定义卡片资源

> **HACS 安装用户无需手动添加资源**，集成启动时会自动注册卡片。

如需手动添加（手动安装时）：

1. 进入 Home Assistant → 设置 → 仪表盘 → 右上角三个点 → 资源
2. 添加资源：
   - **URL**: `/local/water-info-card.js`
   - **类型**: JavaScript 模块

### 添加卡片到仪表盘

在 Lovelace 仪表盘中添加自定义卡片：

```yaml
type: custom:water-info-card
title: 国投水务
yearly_target: "200"
entity_current_reading: sensor.guotou_water_current_reading
entity_balance: sensor.guotou_water_balance
entity_yearly_volume: sensor.guotou_water_yearly_volume
entity_yearly_amount: sensor.guotou_water_yearly_amount
entity_monthly_volume: sensor.guotou_water_monthly_volume
entity_monthly_amount: sensor.guotou_water_monthly_amount
entity_unpaid_amount: sensor.guotou_water_unpaid_amount
entity_unit_price: sensor.guotou_water_unit_price
entity_history_data: sensor.guotou_water_history_data
```

## 传感器实体

安装后将创建以下传感器：

| 实体 | 说明 |
|------|------|
| `sensor.guotou_water_current_reading` | 当前水表读数 (m³) |
| `sensor.guotou_water_balance` | 账户余额 (¥) |
| `sensor.guotou_water_yearly_volume` | 本年用水量 (m³) |
| `sensor.guotou_water_yearly_amount` | 本年水费 (¥) |
| `sensor.guotou_water_monthly_volume` | 本月用水量 (m³) |
| `sensor.guotou_water_monthly_amount` | 本月水费 (¥) |
| `sensor.guotou_water_unpaid_amount` | 未缴费用 (¥) |
| `sensor.guotou_water_unit_price` | 水价单价 (¥/m³) |
| `sensor.guotou_water_history_data` | 历史用水数据 |

## 获取 Token

1. 微信打开小程序
2. 使用抓包工具（如 Yakit）获取请求中的 `house_id` 参数
3. 在集成配置中填入该 house_id

## 注意事项

- house_id 可能会过期，需要重新获取
- 数据更新间隔为每小时一次
- 需要确保 Home Assistant 能够访问 `sqzls.com` 的 API

## 许可证

MIT License
