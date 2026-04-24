const LOG_URL = "./ids_logs.json";
const POLL_INTERVAL = 1000;
const COLORS = {
  normal: "#22c55e",
  http: "#38bdf8",
  syn: "#f43f5e",
  grid: "rgba(147, 168, 199, 0.14)",
};

let activeFilter = "ALL";

function getById(id) {
  return document.getElementById(id);
}

const elements = {
  pollIndicator: getById("poll-indicator"),
  pollStatus: getById("poll-status"),
  lastUpdated: getById("last-updated"),
  heroStatusBadge: getById("hero-status-badge"),
  systemStatus: getById("system-status"),
  systemStatusCopy: getById("system-status-copy"),
  threatLevel: getById("threat-level"),
  threatCopy: getById("threat-copy"),
  connectionsSec: getById("connections-sec"),
  lastAttack: getById("last-attack"),
  lastAttackTime: getById("last-attack-time"),
  normalTraffic: getById("normal-traffic"),
  attackTraffic: getById("attack-traffic"),
  attackPanel: getById("attack-panel"),
  lineChart: getById("line-chart"),
  trafficDonut: getById("traffic-donut"),
  trafficLegend: getById("traffic-legend"),
  barChart: getById("bar-chart"),
  topSrc: getById("top-src"),
  topDst: getById("top-dst"),
  alertsTable: getById("alerts-table"),
  httpCount: getById("http-count"),
  synCount: getById("syn-count"),
  historyNote: getById("history-note"),
  overallDonut: getById("overall-donut"),
  overallLegend: getById("overall-legend"),
  distributionBars: getById("distribution-bars"),
  peakTraffic: getById("peak-traffic"),
  avgTraffic: getById("avg-traffic"),
  totalEvents: getById("total-events"),
  totalAlerts: getById("total-alerts"),
  statusCard: document.querySelector(".status-card"),
  filters: [...document.querySelectorAll(".filter")],
  navLinks: [...document.querySelectorAll(".nav-links a")],
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(timestamp) {
  if (!timestamp) return "No recent attack";
  const diffSec = Math.max(0, Math.round(Date.now() / 1000 - timestamp));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.round(diffSec / 60);
  return `${diffMin} min ago`;
}

function sanitize(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseLogs(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

function buildDataset(events) {
  const summaries = events.filter((event) => event.event === "SUMMARY");
  const alerts = events
    .filter((event) => event.event === "ALERT")
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const latestSummary = summaries[summaries.length - 1] || null;
  const latestAlert = alerts[0] || null;

  const totals = summaries.reduce(
    (acc, entry) => {
      const metrics = entry.metrics || {};
      acc.normal += metrics.normal_rate || 0;
      acc.http += metrics.http_rate || 0;
      acc.syn += metrics.syn_rate || 0;
      acc.total += metrics.total || 0;
      return acc;
    },
    { normal: 0, http: 0, syn: 0, total: 0 }
  );

  const topSrc = new Map();
  const topDst = new Map();

  alerts.forEach((alert) => {
    const weight = (alert.http_rate || 0) + (alert.syn_rate || 0) || 1;
    topSrc.set(alert.src, (topSrc.get(alert.src) || 0) + weight);
    topDst.set(alert.dst, (topDst.get(alert.dst) || 0) + weight);
  });

  const counts = alerts.reduce(
    (acc, alert) => {
      if (alert.type === "HTTP_FLOOD") acc.http += 1;
      if (alert.type === "SYN_FLOOD") acc.syn += 1;
      return acc;
    },
    { http: 0, syn: 0 }
  );

  const summaryWindow = summaries.slice(-30);
  const latestMetrics = latestSummary?.metrics || {};
  const attackTraffic = (latestMetrics.http_rate || 0) + (latestMetrics.syn_rate || 0);
  const isUnderAttack = !!latestSummary && latestSummary.status !== "NORMAL" && attackTraffic > 0;
  const activeAttack =
    isUnderAttack &&
    alerts.find((alert) => alert.type === latestSummary.status) ||
    null;

  const peak = summaries.reduce(
    (max, entry) => Math.max(max, entry.metrics?.total || 0),
    0
  );
  const average =
    summaries.length > 0
      ? summaries.reduce((sum, entry) => sum + (entry.metrics?.total || 0), 0) /
        summaries.length
      : 0;

  return {
    events,
    summaries,
    alerts,
    latestSummary,
    latestAlert,
    latestMetrics,
    totals,
    counts,
    topSrc: [...topSrc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    topDst: [...topDst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    summaryWindow,
    attackTraffic,
    isUnderAttack,
    activeAttack,
    peak,
    average,
  };
}

function renderStatus(data) {
  if (!elements.systemStatus) return;

  const status = data.latestSummary?.status || "NO DATA";
  const threat = data.latestSummary?.threat_level || "-";
  const metrics = data.latestMetrics;

  elements.systemStatus.textContent = data.isUnderAttack
    ? "UNDER ATTACK"
    : status === "NORMAL"
      ? "NORMAL"
      : status;
  elements.systemStatusCopy.textContent = data.isUnderAttack
    ? `Detected ${status.replace("_", " ")} activity in the latest summary.`
    : "Traffic pattern is currently within normal bounds.";
  elements.threatLevel.textContent = threat;
  elements.threatCopy.textContent = data.isUnderAttack
    ? "Elevated malicious traffic is active right now."
    : "No elevated threat pattern in the current summary.";
  elements.connectionsSec.textContent = formatNumber(metrics.total || 0);
  elements.normalTraffic.textContent = formatNumber(metrics.normal_rate || 0);
  elements.attackTraffic.textContent = formatNumber(data.attackTraffic);
  if (elements.httpCount) elements.httpCount.textContent = formatNumber(data.counts.http);
  if (elements.synCount) elements.synCount.textContent = formatNumber(data.counts.syn);

  if (elements.heroStatusBadge) {
    elements.heroStatusBadge.textContent = data.isUnderAttack
      ? `ATTACK: ${status.replace("_", " ")}`
      : "NORMAL";
    elements.heroStatusBadge.classList.toggle("attack", data.isUnderAttack);
  }

  if (elements.statusCard) {
    elements.statusCard.classList.toggle("attack", data.isUnderAttack);
  }

  if (data.latestAlert) {
    elements.lastAttack.textContent = data.latestAlert.type.replace("_", " ");
    elements.lastAttackTime.textContent = formatRelative(data.latestAlert.timestamp);
  } else {
    elements.lastAttack.textContent = "No alerts yet";
    elements.lastAttackTime.textContent = "Monitoring for suspicious traffic.";
  }
}

function renderAttackPanel(data) {
  if (!elements.attackPanel) return;

  if (!data.isUnderAttack || !data.activeAttack) {
    elements.attackPanel.className = "attack-panel secure";
    elements.attackPanel.innerHTML = `
      <div>
        <p class="eyebrow">System Secure</p>
        <h4>No active attack</h4>
        <p class="muted">The latest summary shows stable traffic and no active flood signature.</p>
      </div>
    `;
    return;
  }

  const alert = data.activeAttack;
  const rate = alert.type === "HTTP_FLOOD" ? alert.http_rate : alert.syn_rate;

  elements.attackPanel.className = "attack-panel attacking";
  elements.attackPanel.innerHTML = `
    <div style="width:100%">
      <p class="eyebrow">Active Attack</p>
      <h4>${sanitize(alert.type.replace("_", " "))}</h4>
      <div class="attack-details">
        <div class="detail">
          <span>Source</span>
          <strong>${sanitize(alert.src || "-")}</strong>
        </div>
        <div class="detail">
          <span>Target</span>
          <strong>${sanitize(alert.dst || "-")}</strong>
        </div>
        <div class="detail">
          <span>Rate</span>
          <strong>${formatNumber(rate)} req/sec</strong>
        </div>
        <div class="detail">
          <span>Threat Level</span>
          <strong>${sanitize(alert.severity || data.latestSummary?.threat_level || "HIGH")}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderLineChart(data) {
  if (!elements.lineChart) return;

  const entries = data.summaryWindow;
  if (!entries.length) {
    elements.lineChart.innerHTML = `<div class="empty-state">No summary data available yet.</div>`;
    return;
  }

  const width = 760;
  const height = 280;
  const padding = 28;
  const maxValue = Math.max(...entries.map((entry) => entry.metrics?.total || 0), 1);
  const minX = 0;
  const maxX = Math.max(entries.length - 1, 1);

  const points = entries.map((entry, index) => {
    const x = padding + ((width - padding * 2) * (index - minX)) / (maxX - minX || 1);
    const y =
      height -
      padding -
      ((height - padding * 2) * (entry.metrics?.total || 0)) / maxValue;
    return [x, y, entry];
  });

  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = Math.round(maxValue * ratio);
    const y = height - padding - (height - padding * 2) * ratio;
    return `<g>
      <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="${COLORS.grid}" stroke-dasharray="4 6" />
      <text x="${padding}" y="${y - 6}" class="grid-label">${formatNumber(value)}</text>
    </g>`;
  }).join("");

  const dots = points
    .map(
      ([x, y, entry]) =>
        `<circle class="point-dot" cx="${x}" cy="${y}" r="3.4">
          <title>${formatTime(entry.timestamp)} - ${formatNumber(entry.metrics?.total || 0)} connections</title>
        </circle>`
    )
    .join("");

  const firstTime = formatTime(entries[0].timestamp);
  const lastTime = formatTime(entries[entries.length - 1].timestamp);

  elements.lineChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="line-svg" preserveAspectRatio="none">
      ${gridLines}
      <path d="M ${area}" class="area-path"></path>
      <polyline points="${line}" class="line-path"></polyline>
      ${dots}
      <text x="${padding}" y="${height - 8}" class="axis-text">${sanitize(firstTime)}</text>
      <text x="${width - padding - 70}" y="${height - 8}" class="axis-text">${sanitize(lastTime)}</text>
    </svg>
  `;
}

function setDonut(element, legendElement, items, centerLabel) {
  if (!element || !legendElement) return;

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    element.style.background = "conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)";
    element.dataset.center = "No\nData";
    legendElement.innerHTML = `<div class="empty-state">No traffic captured in the current view.</div>`;
    return;
  }

  let current = 0;
  const segments = items
    .map((item) => {
      const start = current;
      const share = (item.value / total) * 360;
      current += share;
      return `${item.color} ${start}deg ${current}deg`;
    })
    .join(", ");

  element.style.background = `conic-gradient(${segments})`;
  element.dataset.center = centerLabel;
  legendElement.innerHTML = items
    .map((item) => {
      const pct = ((item.value / total) * 100).toFixed(1);
      return `
        <div class="legend-item">
          <div class="legend-left">
            <span class="swatch" style="background:${item.color}"></span>
            <span>${sanitize(item.label)}</span>
          </div>
          <small>${pct}%</small>
        </div>
      `;
    })
    .join("");
}

function renderIntensityBars(data) {
  if (!elements.barChart) return;

  const items = [
    { label: "HTTP Rate", value: data.latestMetrics.http_rate || 0, color: COLORS.http },
    { label: "SYN Rate", value: data.latestMetrics.syn_rate || 0, color: COLORS.syn },
  ];
  const max = Math.max(...items.map((item) => item.value), 1);

  elements.barChart.innerHTML = items
    .map(
      (item) => `
        <div class="bar-row">
          <div class="bar-meta">
            <strong>${sanitize(item.label)}</strong>
            <span>${formatNumber(item.value)} req/sec</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(item.value / max) * 100}%;background:${item.color}"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderIpList(element, entries, label) {
  if (!element) return;

  if (!entries.length) {
    element.innerHTML = `<div class="empty-state">No ${label.toLowerCase()} captured in alert data yet.</div>`;
    return;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);
  element.innerHTML = entries
    .map(
      ([ip, value]) => `
        <div class="ip-row">
          <div class="ip-meta">
            <strong>${sanitize(ip || "-")}</strong>
            <span>${formatNumber(value)} connections</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(value / max) * 100}%;background:linear-gradient(90deg, ${COLORS.http}, ${COLORS.syn})"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function determineResolved(alert, summaries) {
  const laterNormal = summaries.find(
    (summary) =>
      (summary.timestamp || 0) > (alert.timestamp || 0) && summary.status === "NORMAL"
  );
  return laterNormal ? "Resolved" : "Active";
}

function renderAlerts(data) {
  if (!elements.alertsTable || !elements.historyNote) return;

  const filtered =
    activeFilter === "ALL"
      ? data.alerts
      : data.alerts.filter((alert) => alert.type === activeFilter);

  if (!filtered.length) {
    elements.alertsTable.innerHTML = `
      <tr>
        <td colspan="4"><div class="empty-state">No alerts match the selected filter.</div></td>
      </tr>
    `;
  } else {
    elements.alertsTable.innerHTML = filtered
      .slice(0, 20)
      .map((alert) => {
        const status = determineResolved(alert, data.summaries);
        return `
          <tr>
            <td>${sanitize(formatTime(alert.timestamp))}</td>
            <td>${sanitize(alert.type)}</td>
            <td><span class="severity-pill ${String(alert.severity || "LOW").toLowerCase()}">${sanitize(alert.severity || "LOW")}</span></td>
            <td><span class="status-pill ${status.toLowerCase()}">${status}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  const selectedLabel = activeFilter === "ALL" ? "all attacks" : activeFilter.replace("_", " ");
  elements.historyNote.textContent = `Showing ${filtered.length} alert entries for ${selectedLabel}. The dashboard refreshes every second from ids_logs.json.`;
}

function renderAnalytics(data) {
  if (elements.trafficDonut && elements.trafficLegend) {
    setDonut(
      elements.trafficDonut,
      elements.trafficLegend,
      [
        { label: "Normal", value: data.latestMetrics.normal_rate || 0, color: COLORS.normal },
        { label: "HTTP", value: data.latestMetrics.http_rate || 0, color: COLORS.http },
        { label: "SYN", value: data.latestMetrics.syn_rate || 0, color: COLORS.syn },
      ],
      `${formatNumber(data.latestMetrics.total || 0)}\ncurrent cps`
    );
  }

  if (elements.overallDonut && elements.overallLegend) {
    setDonut(
      elements.overallDonut,
      elements.overallLegend,
      [
        { label: "Normal Traffic", value: data.totals.normal, color: COLORS.normal },
        { label: "Attack Traffic", value: data.totals.http + data.totals.syn, color: COLORS.syn },
      ],
      `${formatNumber(data.totals.total)}\ntotal flow`
    );
  }

  const dist = [
    { label: "HTTP Flood", value: data.counts.http, color: COLORS.http },
    { label: "SYN Flood", value: data.counts.syn, color: COLORS.syn },
  ];
  const max = Math.max(...dist.map((item) => item.value), 1);

  if (elements.distributionBars) {
    elements.distributionBars.innerHTML = dist
      .map(
        (item) => `
          <div class="distribution-row">
            <div class="bar-meta">
              <strong>${sanitize(item.label)}</strong>
              <span>${formatNumber(item.value)} alerts</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(item.value / max) * 100}%;background:${item.color}"></div>
            </div>
          </div>
        `
      )
      .join("");
  }

  if (elements.peakTraffic) elements.peakTraffic.textContent = `${formatNumber(data.peak)} conn/sec`;
  if (elements.avgTraffic) elements.avgTraffic.textContent = `${formatNumber(data.average)} conn/sec`;
  if (elements.totalEvents) elements.totalEvents.textContent = formatNumber(data.events.length);
  if (elements.totalAlerts) elements.totalAlerts.textContent = formatNumber(data.alerts.length);
}

function initNavLinks() {
  const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
  const normalizedPage = currentPage === "index.html" ? "dashboard.html" : currentPage;

  elements.navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href");
    link.classList.toggle("active", linkPage === normalizedPage);
  });
}

async function refresh() {
  try {
    const response = await fetch(`${LOG_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const events = parseLogs(text);
    const data = buildDataset(events);

    renderStatus(data);
    renderAttackPanel(data);
    renderLineChart(data);
    renderIntensityBars(data);
    renderIpList(elements.topSrc, data.topSrc, "source IPs");
    renderIpList(elements.topDst, data.topDst, "destination IPs");
    renderAlerts(data);
    renderAnalytics(data);

    if (elements.pollIndicator) {
      elements.pollIndicator.className = `indicator ${data.isUnderAttack ? "alert" : "online"}`;
    }
    if (elements.pollStatus) {
      elements.pollStatus.textContent = data.isUnderAttack
        ? "Attack traffic visible in feed"
        : "Feed online and stable";
    }
    if (elements.lastUpdated) {
      elements.lastUpdated.textContent = `Last refresh: ${new Date().toLocaleTimeString("en-US")}`;
    }
  } catch (error) {
    if (elements.pollIndicator) elements.pollIndicator.className = "indicator";
    if (elements.pollStatus) elements.pollStatus.textContent = "Unable to read ids_logs.json";
    if (elements.lastUpdated) {
      elements.lastUpdated.textContent = "Check that the site is being served from a web server.";
    }
    console.error(error);
  }
}

function initFilters() {
  elements.filters.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      elements.filters.forEach((node) => node.classList.toggle("active", node === button));
      refresh();
    });
  });
}

initNavLinks();
initFilters();
refresh();
setInterval(refresh, POLL_INTERVAL);
