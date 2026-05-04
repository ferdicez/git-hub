const API_BASE = 'https://api.coingecko.com/api/v3';
const REFRESH_INTERVAL_MS = 60_000;

// Instâncias dos gráficos — guardadas para poder atualizar sem duplicar
let mainChartInstance = null;
let weeklyChartInstance = null;
let yearlyChartInstance = null;

// ── Formatadores de número ──────────────────────────────────────────────────

function formatUSD(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatShort(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(2)}M`;
  return formatUSD(value);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateFull(timestamp) {
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Busca de dados ──────────────────────────────────────────────────────────

async function fetchCurrentStats() {
  const res = await fetch(
    `${API_BASE}/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false`
  );
  if (!res.ok) throw new Error('Erro ao buscar dados atuais');
  return res.json();
}

async function fetchChartData(days) {
  const interval = days <= 90 ? 'daily' : 'daily';
  const res = await fetch(
    `${API_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=${interval}`
  );
  if (!res.ok) throw new Error('Erro ao buscar histórico');
  return res.json();
}

async function fetchRangeData(fromTimestamp, toTimestamp) {
  const res = await fetch(
    `${API_BASE}/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`
  );
  if (!res.ok) throw new Error('Erro ao buscar período');
  return res.json();
}

// ── Atualização dos cards de estatísticas ──────────────────────────────────

function updateStats(data) {
  const market = data.market_data;

  document.getElementById('priceUsd').textContent = formatUSD(market.current_price.usd);
  document.getElementById('priceBrl').textContent = formatBRL(market.current_price.brl);
  document.getElementById('marketCap').textContent = formatShort(market.market_cap.usd);
  document.getElementById('volume24h').textContent = formatShort(market.total_volume.usd);
  document.getElementById('ath').textContent = formatUSD(market.ath.usd);

  const pct = market.price_change_percentage_24h;
  const changeEl = document.getElementById('change24h');
  changeEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  changeEl.className = `stat-value ${pct >= 0 ? 'positive' : 'negative'}`;
}

// ── Renderização de gráficos ────────────────────────────────────────────────

function buildChartConfig({ labels, prices, label, fill = false, tension = 0.3 }) {
  const first = prices[0];
  const last = prices[prices.length - 1];
  const color = last >= first ? '#22c55e' : '#ef4444';
  const colorAlpha = last >= first ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';

  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data: prices,
        borderColor: color,
        backgroundColor: fill ? colorAlpha : 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        fill,
        tension,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e2028',
          borderColor: '#2a2d36',
          borderWidth: 1,
          titleColor: '#8a8d99',
          bodyColor: '#f0f0f5',
          callbacks: {
            label: ctx => ` ${formatUSD(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e2028' },
          ticks: { color: '#8a8d99', maxTicksLimit: 8, font: { size: 11 } },
        },
        y: {
          grid: { color: '#1e2028' },
          ticks: {
            color: '#8a8d99',
            font: { size: 11 },
            callback: val => formatShort(val),
          },
          position: 'right',
        },
      },
    },
  };
}

function renderMainChart(chartData, periodLabel) {
  const labels = chartData.prices.map(p => formatDateFull(p[0]));
  const prices = chartData.prices.map(p => p[1]);

  if (mainChartInstance) mainChartInstance.destroy();

  const ctx = document.getElementById('mainChart').getContext('2d');
  mainChartInstance = new Chart(ctx, buildChartConfig({ labels, prices, label: periodLabel, fill: true }));
}

function renderWeeklyChart(chartData) {
  const labels = chartData.prices.map(p => formatDate(p[0]));
  const prices = chartData.prices.map(p => p[1]);

  if (weeklyChartInstance) weeklyChartInstance.destroy();

  const ctx = document.getElementById('weeklyChart').getContext('2d');
  weeklyChartInstance = new Chart(ctx, buildChartConfig({ labels, prices, label: '7 dias', fill: true, tension: 0.4 }));
}

function renderYearlyChart(chartData) {
  const labels = chartData.prices.map(p => formatDate(p[0]));
  const prices = chartData.prices.map(p => p[1]);

  if (yearlyChartInstance) yearlyChartInstance.destroy();

  const ctx = document.getElementById('yearlyChart').getContext('2d');
  yearlyChartInstance = new Chart(ctx, buildChartConfig({ labels, prices, label: '1 ano', fill: false, tension: 0.2 }));
}

// ── Status de atualização ───────────────────────────────────────────────────

function setStatus(text) {
  document.getElementById('updateStatus').textContent = text;
}

// ── Controles de período ────────────────────────────────────────────────────

let activeDays = 7;

async function loadMainChart(days, label) {
  setStatus('Carregando gráfico...');
  try {
    const daysParam = days === 'max' ? 'max' : days;
    const data = await fetchChartData(daysParam);
    renderMainChart(data, label);
    setStatus(nowString());
  } catch {
    setStatus('Erro ao carregar gráfico');
  }
}

function nowString() {
  return `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function setupPeriodButtons() {
  const buttons = document.querySelectorAll('.btn-period');
  const labels = { 7: '7 Dias', 30: '30 Dias', 90: '90 Dias', 365: '1 Ano', max: 'Máximo' };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDays = btn.dataset.days;
      loadMainChart(activeDays, labels[activeDays]);
    });
  });
}

function setupDateRange() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  document.getElementById('dateTo').value = today.toISOString().split('T')[0];
  document.getElementById('dateFrom').value = weekAgo.toISOString().split('T')[0];

  document.getElementById('applyRange').addEventListener('click', async () => {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;

    if (!from || !to) return;

    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    const toTs   = Math.floor(new Date(to).getTime() / 1000) + 86400;

    document.querySelectorAll('.btn-period').forEach(b => b.classList.remove('active'));
    setStatus('Carregando período...');

    try {
      const data = await fetchRangeData(fromTs, toTs);
      renderMainChart(data, `${from} → ${to}`);
      setStatus(nowString());
    } catch {
      setStatus('Erro ao carregar período');
    }
  });
}

// ── Inicialização e refresh ─────────────────────────────────────────────────

async function refreshStats() {
  try {
    const data = await fetchCurrentStats();
    updateStats(data);
    setStatus(nowString());
  } catch {
    setStatus('Erro ao atualizar preço');
  }
}

async function init() {
  setStatus('Carregando...');

  setupPeriodButtons();
  setupDateRange();

  // Carrega tudo em paralelo para ser mais rápido
  await Promise.allSettled([
    refreshStats(),
    fetchChartData(7).then(renderWeeklyChart),
    fetchChartData(365).then(renderYearlyChart),
    loadMainChart(7, '7 Dias'),
  ]);

  // Atualiza o preço automaticamente a cada 60 segundos
  setInterval(refreshStats, REFRESH_INTERVAL_MS);
}

init();
