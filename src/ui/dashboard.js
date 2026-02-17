const toDate = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const isInSelectedMonth = (dateValue, selectedMonth) => {
  if (!selectedMonth) return true;

  const date = toDate(dateValue);
  if (!date) return false;

  const [year, month] = selectedMonth.split("-").map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
};

export const updateDashboard = (state, utils) => {
  const stats = { descongel: 0, multi400: 0, multi800: 0, pending: 0, egresos: 0 };
  const selectedMonth = state.filters?.date || "";
  const filteredPayments = state.payments.filter((payment) => isInSelectedMonth(payment.date, selectedMonth));
  const filteredMovements = state.movements.filter((movement) => isInSelectedMonth(movement.date, selectedMonth));

  filteredPayments.forEach((p) => {
    if (p.product === "descongel") stats.descongel += p.quantity;
    if (p.product === "multidol400") stats.multi400 += p.quantity;
    if (p.product === "multidol800") stats.multi800 += p.quantity;
    if (p.status === "pendiente") stats.pending += 1;
  });

  const movementEgresos = filteredMovements
    .filter((m) => m.type === "egreso")
    .reduce((acc, m) => acc + (m.amount || 0), 0);

  const movementReintegros = filteredMovements
    .filter((m) => m.type === "reintegro")
    .reduce((acc, m) => acc + (m.amount || 0), 0);

  const legacyEgresos = filteredPayments.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
  const legacyReintegros = filteredPayments.reduce((acc, p) => acc + (p.reimbursedAmount || 0), 0);

  const hasMovementEgresos = filteredMovements.some((m) => m.type === "egreso");
  const hasMovementReintegros = filteredMovements.some((m) => m.type === "reintegro");
  const allowLegacyFallback = Boolean(state.featureFlags?.allowLegacyCashFallback);

  const usingLegacyEgresos = !hasMovementEgresos && allowLegacyFallback;
  const usingLegacyReintegros = !hasMovementReintegros && allowLegacyFallback;

  stats.egresos = usingLegacyEgresos ? legacyEgresos : movementEgresos;
  const totalReintegros = usingLegacyReintegros ? legacyReintegros : movementReintegros;

  const available = state.budget + totalReintegros - stats.egresos;
  const usagePercent = state.budget > 0 ? (stats.egresos / state.budget) * 100 : 0;

  document.getElementById("stat-descongel").textContent = stats.descongel;
  document.getElementById("stat-multi400").textContent = stats.multi400;
  document.getElementById("stat-multi800").textContent = stats.multi800;
  document.getElementById("stat-pending").textContent = stats.pending;

  document.getElementById("kpi-available").textContent = utils.fmtMoney(available);
  document.getElementById("kpi-egresos").textContent = `Egresos: ${utils.fmtMoney(stats.egresos)}`;

  const migrationBadge = document.getElementById("kpi-data-source");
  if (migrationBadge) {
    const isMixedMode = usingLegacyEgresos || usingLegacyReintegros;
    migrationBadge.textContent = isMixedMode ? "Datos mixtos" : "Datos migrados";
    migrationBadge.className = `badge fw-normal ${isMixedMode ? "bg-warning text-dark" : "bg-success-subtle text-success"}`;
  }

  const percentText = document.getElementById("kpi-percentage");
  const progressBar = document.getElementById("budget-progress");

  percentText.textContent = `${usagePercent.toFixed(1)}% Usado`;
  progressBar.style.width = `${Math.min(usagePercent, 100)}%`;

  if (usagePercent > 100) {
    progressBar.style.background = "var(--danger)";
    percentText.classList.add("text-warning");
  } else if (usagePercent > 70) {
    progressBar.style.background = "var(--warning)";
  } else {
    progressBar.style.background = "rgba(255, 255, 255, 0.9)";
    percentText.classList.remove("text-warning");
  }
};
