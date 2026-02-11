/**
 * Water Info Card for Home Assistant
 * 水务信息卡片 v2.0.0
 * 基于 gas-info-card-v3 样式重构
 * 功能: 余额显示、月度账单日历、交互式图表、缴费状态
 */

class WaterInfoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._currentView = 'overview';
    this._calendarMonth = new Date();
    this._lastDataHash = null;
    this._animationPlayed = {};
  }

  set hass(hass) {
    this._hass = hass;
    this._updateCard();
  }

  setConfig(config) {
    if (!config.entity_yearly_volume && !config.entity_monthly_volume) {
      throw new Error('请至少配置一个实体');
    }
    this._config = config;
  }

  _getState(entityId) {
    if (!entityId || !this._hass) return null;
    const entity = this._hass.states[entityId];
    return entity ? entity.state : null;
  }

  _getAttribute(entityId, attr) {
    if (!entityId || !this._hass) return null;
    const entity = this._hass.states[entityId];
    return entity && entity.attributes ? entity.attributes[attr] : null;
  }

  _switchView(view) {
    this._currentView = view;
    this._animationPlayed[view] = false;
    this._updateCard();
  }

  _changeCalendarMonth(delta) {
    this._calendarMonth = new Date(this._calendarMonth.getFullYear() + delta, this._calendarMonth.getMonth(), 1);
    this._updateCard();
  }

  _updateCard() {
    if (!this._hass || !this._config) return;

    const config = this._config;
    const theme = config.theme || '';
    const title = config.title || '国投水务';

    // 获取数据
    const currentReading = this._getState(config.entity_current_reading) || '--';
    const balance = this._getState(config.entity_balance) || '--';
    const yearlyVolume = this._getState(config.entity_yearly_volume) || '0';
    const yearlyAmount = this._getState(config.entity_yearly_amount) || '0';
    const monthlyVolume = this._getState(config.entity_monthly_volume) || '0';
    const monthlyAmount = this._getState(config.entity_monthly_amount) || '0';
    const unpaidAmount = this._getState(config.entity_unpaid_amount) || '0';
    const unitPrice = this._getState(config.entity_unit_price) || '--';

    // 获取历史数据
    const historyEntity = config.entity_history_data || 'sensor.guotou_water_history_data';
    let monthlyHistory = this._getAttribute(historyEntity, 'monthly_history') || [];

    // 向后兼容
    if (monthlyHistory.length === 0) {
      monthlyHistory = this._getAttribute(config.entity_yearly_volume, 'monthly_history') || [];
    }

    // 更新时间
    const querytime = this._getAttribute(config.entity_monthly_volume, 'querytime') ||
      this._getAttribute(config.entity_yearly_volume, 'querytime');
    let formattedTime = '--';
    if (querytime) {
      const date = new Date(querytime);
      formattedTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // 计算数据哈希
    const dataHash = JSON.stringify({
      balance, monthlyAmount, monthlyHistory: monthlyHistory.length,
      view: this._currentView, calMonth: this._calendarMonth.getTime()
    });

    const needFullRender = this._lastDataHash !== dataHash;
    if (!needFullRender) return;
    this._lastDataHash = dataHash;

    const shouldAnimate = !this._animationPlayed[this._currentView];
    if (shouldAnimate) {
      this._animationPlayed[this._currentView] = true;
    }

    // 年度进度条
    let progressHtml = '';
    if (config.yearly_target) {
      const target = parseFloat(config.yearly_target);
      const current = parseFloat(yearlyVolume);
      const percentage = Math.min((current / target) * 100, 100);
      progressHtml = `
        <div class="progress-section">
          <div class="progress-label">
            <span>年度用水进度</span>
            <span>${percentage.toFixed(1)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="progress-markers">
            <span>0</span>
            <span>目标: ${target} m³</span>
            <span>${target}</span>
          </div>
        </div>
      `;
    }

    // 生成月度账单日历 HTML
    const renderCalendar = () => {
      const year = this._calendarMonth.getFullYear();

      const usageMap = {};
      monthlyHistory.forEach(d => {
        if (d.date) {
          const parts = d.date.split('-');
          const dataYear = parseInt(parts[0], 10);
          const dataMonth = parseInt(parts[1], 10) - 1;
          if (dataYear === year) {
            const unitP = d.volume > 0 ? (d.amount / d.volume).toFixed(2) : '--';
            const isPaidValue = d.is_paid === true || d.is_paid === 'true';
            usageMap[dataMonth] = { volume: d.volume, amount: d.amount, date: d.date, unitPrice: unitP, isPaid: isPaidValue };
          }
        }
      });

      // 找到最新有数据的月份
      let latestMonthWithData = -1;
      for (let m = 11; m >= 0; m--) {
        if (usageMap[m]) { latestMonthWithData = m; break; }
      }

      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      let calendarHtml = `
        <div class="calendar-header">
          <button class="cal-nav" id="cal-prev">&lt;</button>
          <span>${year}年</span>
          <button class="cal-nav" id="cal-next">&gt;</button>
        </div>
        <div class="month-grid">
      `;

      const today = new Date();
      for (let m = 0; m < 12; m++) {
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === m;
        const usage = usageMap[m];
        const hasData = usage && usage.volume > 0;
        const isLatestMonth = m === latestMonthWithData;
        const showUnpaid = isLatestMonth && hasData && !usage.isPaid;

        calendarHtml += `
          <div class="month-cell ${isCurrentMonth ? 'current' : ''} ${hasData ? 'has-data' : ''} ${showUnpaid ? 'unpaid' : ''}" 
               data-volume="${hasData ? usage.volume : ''}" 
               data-amount="${hasData ? usage.amount : ''}"
               data-date="${hasData ? usage.date : ''}"
               data-price="${hasData ? usage.unitPrice : ''}"
               data-paid="${hasData ? usage.isPaid : ''}"
               data-latest="${isLatestMonth}">
            <span class="month-name">${months[m]}</span>
            ${hasData ? `<span class="month-usage">${usage.volume}m³</span>` : ''}
            ${hasData ? `<span class="month-cost">¥${parseFloat(usage.amount).toFixed(0)}</span>` : ''}
            ${showUnpaid ? '<span class="unpaid-tag">未缴</span>' : ''}
          </div>
        `;
      }

      calendarHtml += '</div><div class="calendar-tooltip" id="cal-tooltip"></div>';
      return calendarHtml;
    };

    // 生成月用水图表 (近12个月)
    const renderMonthlyChart = () => {
      const today = new Date();
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      let endIndex = monthlyHistory.findIndex(d => d.date === currentMonthStr);
      if (endIndex === -1) endIndex = monthlyHistory.length - 1;
      const startIndex = Math.max(0, endIndex - 11);
      const last12Months = monthlyHistory.slice(startIndex, endIndex + 1);

      if (last12Months.length === 0) {
        return '<div class="no-data">暂无数据</div>';
      }
      const maxVolume = Math.max(...last12Months.map(d => d.volume || 0), 0.1);
      const yTicks = [0, Math.round(maxVolume / 2), Math.round(maxVolume)];
      const latestIndex = last12Months.length - 1;

      let html = `
        <div class="chart-container">
          <div class="chart-y-axis">
            <span class="y-label">${yTicks[2]}</span>
            <span class="y-label">${yTicks[1]}</span>
            <span class="y-label">${yTicks[0]}</span>
            <span class="y-unit">m³</span>
          </div>
          <div class="chart-main">
            <div class="chart-bars monthly">
      `;
      last12Months.forEach((item, index) => {
        const volumeHeight = (item.volume / maxVolume) * 100;
        let label = '';
        if (item.date) {
          const parts = item.date.split('-');
          label = parts[0].slice(2) + '-' + parts[1];
        } else {
          label = (index + 1) + '月';
        }
        const unitP = item.volume > 0 ? (item.amount / item.volume).toFixed(2) : '--';
        const isPaidValue = item.is_paid === true || item.is_paid === 'true';
        const isLatest = index === latestIndex;
        const showUnpaid = isLatest && !isPaidValue;

        const animClass = shouldAnimate ? 'animated' : '';
        const delay = shouldAnimate ? index * 80 : 0;
        const heightStyle = shouldAnimate ? `--target-height: ${volumeHeight}%; animation-delay: ${delay}ms;` : `height: ${volumeHeight}%;`;
        html += `
          <div class="chart-bar-wrapper">
            <div class="chart-bar" data-volume="${item.volume}" data-amount="${item.amount}" data-date="${item.date || ''}" data-price="${unitP}" data-paid="${isPaidValue}" data-latest="${isLatest}">
              <div class="bar-fill monthly ${animClass} ${showUnpaid ? 'unpaid' : ''}" style="${heightStyle}"></div>
            </div>
            <div class="bar-label">${label}</div>
          </div>
        `;
      });
      html += '</div></div><div class="tooltip" id="tooltip-monthly"></div></div>';
      return html;
    };

    // 根据当前视图生成内容
    let viewContent = '';
    if (this._currentView === 'overview') {
      viewContent = `
        <div class="overview-section">
          <div class="stats-container">
            <div class="stat-box">
              <div class="stat-header">💧 本月</div>
              <div class="stat-row">
                <div class="stat-item">
                  <div class="stat-value blue">${parseFloat(monthlyVolume).toFixed(2)}<span class="stat-unit">m³</span></div>
                  <div class="stat-label">用量</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value orange">${parseFloat(monthlyAmount).toFixed(2)}<span class="stat-unit">元</span></div>
                  <div class="stat-label">费用</div>
                </div>
              </div>
            </div>
            <div class="stat-box">
              <div class="stat-header">📊 本年</div>
              <div class="stat-row">
                <div class="stat-item">
                  <div class="stat-value blue">${parseFloat(yearlyVolume).toFixed(2)}<span class="stat-unit">m³</span></div>
                  <div class="stat-label">用量</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value orange">${parseFloat(yearlyAmount).toFixed(2)}<span class="stat-unit">元</span></div>
                  <div class="stat-label">费用</div>
                </div>
              </div>
            </div>
          </div>
          ${progressHtml}
        </div>
      `;
    } else if (this._currentView === 'calendar') {
      viewContent = `<div class="calendar-section">${renderCalendar()}</div>`;
    } else if (this._currentView === 'monthly') {
      viewContent = `
        <div class="chart-section">
          <div class="chart-header">近12个月用水量 (鼠标悬停查看详情)</div>
          ${renderMonthlyChart()}
        </div>
      `;
    }

    const balanceDisplay = balance !== '--' ? parseFloat(balance).toFixed(2) : '--';
    const readingDisplay = currentReading !== '--' ? parseFloat(currentReading).toFixed(2) : '--';
    const priceDisplay = unitPrice !== '--' ? parseFloat(unitPrice).toFixed(2) : '--';
    const unpaidDisplay = parseFloat(unpaidAmount).toFixed(2);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .water-card {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border-radius: 16px;
          padding: 16px;
          color: #333;
          position: relative;
          box-sizing: border-box;
          height: 430px;
          display: flex;
          flex-direction: column;
        }
        .water-card.dark {
          background: linear-gradient(135deg, #37474f 0%, #263238 100%);
          color: #e0e0e0;
        }
        .header { text-align: center; margin-bottom: 8px; }
        .title {
          font-size: 18px; font-weight: 600; color: #1976d2;
          display: flex; align-items: center; justify-content: center; gap: 4px;
        }
        .balance-section {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); margin-bottom: 12px;
        }
        .balance-left { display: flex; flex-direction: column; gap: 2px; }
        .info-row { font-size: 13px; color: #333; }
        .info-label { color: #888; }
        .info-value { font-weight: 600; color: #1976d2; }
        .info-value.price { color: #ff5722; }
        .balance-right { text-align: right; }
        .cost-row { font-size: 13px; color: #333; }
        .cost-label { color: #888; font-size: 12px; }
        .balance-value { font-size: 13px; font-weight: 600; color: #4caf50; }
        .unpaid-info { font-size: 12px; margin-top: 2px; }
        .unpaid-val { font-weight: 600; }
        .unpaid-val.zero { color: #4caf50; }
        .unpaid-val.has { color: #f44336; }
        .update-time { font-size: 11px; color: #888; margin-top: 4px; }

        .tabs { display: flex; gap: 6px; margin-bottom: 12px; margin-top: 8px; flex-wrap: wrap; }
        .tab-btn {
          flex: 1; min-width: 60px; padding: 8px 6px; border: none;
          background: rgba(255,255,255,0.6); border-radius: 8px;
          cursor: pointer; font-size: 12px; font-weight: 500; color: #666;
          transition: all 0.2s;
        }
        .tab-btn:hover { background: rgba(255,255,255,0.9); }
        .tab-btn.active {
          background: linear-gradient(135deg, #1976d2, #42a5f5);
          color: white;
        }

        .view-content { flex: 1; overflow: visible; }

        .overview-section { padding: 6px; }
        .stats-container { display: flex; gap: 10px; margin-bottom: 12px; margin-top: 20px; }
        .stat-box {
          flex: 1; background: rgba(255,255,255,0.6); border-radius: 12px; padding: 10px;
        }
        .stat-header { font-size: 12px; color: #666; margin-bottom: 8px; font-weight: 500; }
        .stat-row { display: flex; justify-content: space-around; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 16px; font-weight: 600; }
        .stat-value.blue { color: #1976d2; }
        .stat-value.orange { color: #ff9800; }
        .stat-unit { font-size: 10px; margin-left: 2px; color: #888; }
        .stat-label { font-size: 10px; color: #888; }

        .progress-section { margin-top: 20px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1); }
        .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 6px; }
        .progress-bar { height: 16px; background: rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
        .progress-fill {
          height: 100%; background: linear-gradient(90deg, #4caf50, #8bc34a, #ffeb3b, #ff9800, #f44336);
          border-radius: 8px; transition: width 0.5s;
        }
        .progress-markers { display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 4px; }

        /* 月度账单日历 - 紧凑版 */
        .calendar-section { background: rgba(255,255,255,0.6); border-radius: 12px; padding: 8px; position: relative; }
        .calendar-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 6px; font-weight: 600; color: #1976d2; font-size: 13px;
        }
        .cal-nav {
          background: none; border: none; font-size: 14px; cursor: pointer;
          color: #1976d2; padding: 4px 8px;
        }
        .month-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
        }
        .month-cell {
          min-height: 30px; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          border-radius: 4px; background: rgba(255,255,255,0.5); padding: 3px 3px;
          cursor: default; position: relative; line-height: 1.3;
        }
        .month-cell.current { background: #e3f2fd; border: 1px solid #1976d2; }
        .month-cell.has-data { background: #e8f5e9; cursor: pointer; }
        .month-cell.unpaid { background: #fff3e0; border: 1px solid #ff9800; }
        .month-name { font-weight: 500; font-size: 9px; color: #666; }
        .month-usage { font-size: 8px; color: #1976d2; font-weight: 500; }
        .month-cost { font-size: 7px; color: #888; }
        .unpaid-tag {
          font-size: 6px; background: #f44336; color: white; padding: 0px 2px;
          border-radius: 2px; position: absolute; top: 1px; right: 1px;
        }
        .calendar-tooltip {
          position: absolute; background: rgba(0,0,0,0.85); color: white;
          padding: 10px 14px; border-radius: 8px; font-size: 12px;
          pointer-events: none; opacity: 0; transition: opacity 0.2s;
          z-index: 100; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .calendar-tooltip.visible { opacity: 1; }

        /* 图表样式 */
        .chart-section { background: rgba(255,255,255,0.6); border-radius: 12px; padding: 12px; }
        .chart-header { font-size: 13px; font-weight: 500; color: #666; margin-bottom: 12px; }
        .chart-container { display: flex; position: relative; }
        .chart-y-axis {
          display: flex; flex-direction: column; justify-content: space-between;
          align-items: flex-end; padding-right: 8px; width: 35px; height: 150px;
        }
        .y-label { font-size: 10px; color: #888; }
        .y-unit { font-size: 10px; color: #1976d2; font-weight: 600; margin-top: 4px; }
        .chart-main { flex: 1; position: relative; }
        .chart-bars { display: flex; align-items: flex-end; height: 150px; gap: 6px; }
        .chart-bars.monthly { gap: 4px; }
        .chart-bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
        .chart-bar {
          width: 100%; max-width: 30px; background: rgba(0,0,0,0.05);
          border-radius: 4px 4px 0 0; flex: 1; display: flex;
          flex-direction: column; justify-content: flex-end; cursor: pointer;
        }
        .bar-fill {
          width: 100%; background: linear-gradient(180deg, #1976d2, #64b5f6);
          border-radius: 4px 4px 0 0;
        }
        .bar-fill.animated {
          height: 0;
          animation: growBar 0.6s ease-out forwards;
        }
        @keyframes growBar {
          from { height: 0; }
          to { height: var(--target-height); }
        }
        .bar-fill.monthly { background: linear-gradient(180deg, #42a5f5, #90caf9); }
        .bar-fill.unpaid { background: linear-gradient(180deg, #f44336, #ef9a9a); }
        .bar-label { font-size: 10px; color: #888; margin-top: 4px; }

        .tooltip {
          position: absolute; background: rgba(0,0,0,0.85); color: white;
          padding: 10px 14px; border-radius: 8px; font-size: 12px;
          pointer-events: none; opacity: 0; transition: opacity 0.2s;
          z-index: 100; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .tooltip.visible { opacity: 1; }

        .no-data { text-align: center; color: #888; padding: 30px; }
      </style>

      <div class="water-card ${theme}">
        <div class="header">
          <div class="title">💧 ${title}</div>
        </div>

        <div class="balance-section">
          <div class="balance-left">
            <div class="info-row"><span class="info-label">当前读数: </span><span class="info-value">${readingDisplay} m³</span></div>
            <div class="info-row"><span class="info-label">单价: </span><span class="info-value price">${priceDisplay} 元/m³</span></div>
            <div class="info-row"><span class="info-label">本月: </span><span class="info-value">${parseFloat(monthlyVolume).toFixed(2)} m³ / ¥${parseFloat(monthlyAmount).toFixed(2)}</span></div>
          </div>
          <div class="balance-right">
            <div class="cost-row"><span class="cost-label">余额: </span><span class="balance-value" style="color: ${parseFloat(balance) < 100 ? '#f44336' : '#4caf50'}">¥${balanceDisplay}</span></div>
            <div class="unpaid-info"><span class="cost-label">未缴: </span><span class="unpaid-val ${parseFloat(unpaidAmount) === 0 ? 'zero' : 'has'}">¥${unpaidDisplay}</span></div>
            <div class="update-time">更新: ${formattedTime}</div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn ${this._currentView === 'overview' ? 'active' : ''}" id="tab-overview">概览</button>
          <button class="tab-btn ${this._currentView === 'monthly' ? 'active' : ''}" id="tab-monthly">月用水</button>
          <button class="tab-btn ${this._currentView === 'calendar' ? 'active' : ''}" id="tab-calendar">账单</button>
        </div>

        <div class="view-content">${viewContent}</div>
      </div>
    `;

    // 绑定事件
    this.shadowRoot.getElementById('tab-overview')?.addEventListener('click', () => this._switchView('overview'));
    this.shadowRoot.getElementById('tab-monthly')?.addEventListener('click', () => this._switchView('monthly'));
    this.shadowRoot.getElementById('tab-calendar')?.addEventListener('click', () => this._switchView('calendar'));
    this.shadowRoot.getElementById('cal-prev')?.addEventListener('click', () => this._changeCalendarMonth(-1));
    this.shadowRoot.getElementById('cal-next')?.addEventListener('click', () => this._changeCalendarMonth(1));

    // 绑定悬停事件
    this._setupCalendarTooltips();
    this._setupChartTooltips();
  }

  _setupCalendarTooltips() {
    const monthCells = this.shadowRoot.querySelectorAll('.month-cell.has-data');
    const calTooltip = this.shadowRoot.getElementById('cal-tooltip');
    const calSection = this.shadowRoot.querySelector('.calendar-section');

    if (!calTooltip || !calSection) return;

    monthCells.forEach(cell => {
      cell.addEventListener('mouseenter', (e) => {
        const volume = cell.dataset.volume;
        const amount = cell.dataset.amount;
        const date = cell.dataset.date;
        const price = cell.dataset.price;
        const isPaid = cell.dataset.paid === 'true';
        const isLatest = cell.dataset.latest === 'true';

        if (!volume) return;

        let tooltipContent = `
          <div><strong>${date}</strong></div>
          <div>💧 用水量: ${volume} m³</div>
          <div>💰 费用: ¥${parseFloat(amount).toFixed(2)}</div>
          <div>📊 单价: ${price} 元/m³</div>
        `;
        if (isLatest) {
          tooltipContent += `<div>${isPaid ? '✅ 已缴费' : '❌ 未缴费'}</div>`;
        }
        calTooltip.innerHTML = tooltipContent;
        calTooltip.classList.add('visible');

        const rect = cell.getBoundingClientRect();
        const containerRect = calSection.getBoundingClientRect();
        const left = rect.left - containerRect.left + rect.width / 2;
        const top = rect.bottom - containerRect.top + 8;
        calTooltip.style.left = `${left}px`;
        calTooltip.style.top = `${top}px`;
        calTooltip.style.transform = 'translateX(-50%)';
      });

      cell.addEventListener('mouseleave', () => {
        calTooltip.classList.remove('visible');
      });
    });
  }

  _setupChartTooltips() {
    const chartBars = this.shadowRoot.querySelectorAll('.chart-bar');
    const tooltip = this.shadowRoot.getElementById('tooltip-monthly');

    if (!tooltip) return;

    chartBars.forEach(bar => {
      bar.addEventListener('mouseenter', (e) => {
        const volume = bar.dataset.volume;
        const amount = bar.dataset.amount;
        const date = bar.dataset.date;
        const price = bar.dataset.price;
        const isPaid = bar.dataset.paid === 'true';
        const isLatest = bar.dataset.latest === 'true';

        let tooltipContent = `
          <div><strong>${date}</strong></div>
          <div>💧 用水量: ${volume} m³</div>
          <div>💰 费用: ¥${parseFloat(amount).toFixed(2)}</div>
          <div>📊 单价: ${price} 元/m³</div>
        `;
        if (isLatest) {
          tooltipContent += `<div>${isPaid ? '✅ 已缴费' : '❌ 未缴费'}</div>`;
        }
        tooltip.innerHTML = tooltipContent;
        tooltip.classList.add('visible');

        const rect = bar.getBoundingClientRect();
        const containerRect = bar.closest('.chart-container').getBoundingClientRect();
        tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - containerRect.top - 80}px`;
        tooltip.style.transform = 'translateX(-50%)';
      });

      bar.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
      });
    });
  }

  getCardSize() {
    return 8;
  }

  static getConfigElement() {
    return document.createElement('water-info-card-editor');
  }

  static getStubConfig() {
    return {
      title: "国投水务",
      theme: "",
      yearly_target: "200",
      entity_current_reading: "sensor.guotou_water_current_reading",
      entity_balance: "sensor.guotou_water_balance",
      entity_yearly_volume: "sensor.guotou_water_yearly_volume",
      entity_yearly_amount: "sensor.guotou_water_yearly_amount",
      entity_monthly_volume: "sensor.guotou_water_monthly_volume",
      entity_monthly_amount: "sensor.guotou_water_monthly_amount",
      entity_unpaid_amount: "sensor.guotou_water_unpaid_amount",
      entity_unit_price: "sensor.guotou_water_unit_price",
      entity_history_data: "sensor.guotou_water_history_data"
    };
  }
}

// 配置编辑器
class WaterInfoCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) { this._hass = hass; }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .form-group { margin-bottom: 12px; }
        label { display: block; margin-bottom: 4px; font-weight: 500; }
        input, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .section-title { font-weight: 600; margin: 16px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #eee; }
      </style>
      
      <div class="form-group">
        <label>卡片标题</label>
        <input type="text" id="title" value="${this._config.title || '国投水务'}">
      </div>
      <div class="form-group">
        <label>主题</label>
        <select id="theme">
          <option value="" ${!this._config.theme ? 'selected' : ''}>默认</option>
          <option value="dark" ${this._config.theme === 'dark' ? 'selected' : ''}>暗色</option>
        </select>
      </div>
      <div class="form-group">
        <label>年度目标用量 (m³)</label>
        <input type="text" id="yearly_target" value="${this._config.yearly_target || ''}">
      </div>
      <div class="section-title">传感器实体</div>
      <div class="form-group"><label>当前表读数</label><input type="text" id="entity_current_reading" value="${this._config.entity_current_reading || ''}"></div>
      <div class="form-group"><label>账户余额</label><input type="text" id="entity_balance" value="${this._config.entity_balance || ''}"></div>
      <div class="form-group"><label>本年用水量</label><input type="text" id="entity_yearly_volume" value="${this._config.entity_yearly_volume || ''}"></div>
      <div class="form-group"><label>本年水费</label><input type="text" id="entity_yearly_amount" value="${this._config.entity_yearly_amount || ''}"></div>
      <div class="form-group"><label>本月用水量</label><input type="text" id="entity_monthly_volume" value="${this._config.entity_monthly_volume || ''}"></div>
      <div class="form-group"><label>本月水费</label><input type="text" id="entity_monthly_amount" value="${this._config.entity_monthly_amount || ''}"></div>
      <div class="form-group"><label>未缴费用</label><input type="text" id="entity_unpaid_amount" value="${this._config.entity_unpaid_amount || ''}"></div>
      <div class="form-group"><label>水价单价</label><input type="text" id="entity_unit_price" value="${this._config.entity_unit_price || ''}"></div>
      <div class="form-group"><label>历史数据</label><input type="text" id="entity_history_data" value="${this._config.entity_history_data || ''}"></div>
    `;

    this.shadowRoot.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', (e) => {
        const newConfig = { ...this._config };
        newConfig[e.target.id] = e.target.value;
        this._config = newConfig;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
      });
    });
  }
}

customElements.define('water-info-card', WaterInfoCard);
customElements.define('water-info-card-editor', WaterInfoCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({ type: 'water-info-card', name: '水务信息卡片', description: '国投水务信息卡片 v2.0', preview: true });

console.info('%c WATER-INFO-CARD %c v2.0.0 ', 'color: white; background: #1976d2; font-weight: bold;', 'color: #1976d2; background: white; font-weight: bold;');
