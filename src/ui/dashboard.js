export const updateDashboard = (state, utils) => {
  const stats = { descongel: 0, multi400: 0, multi800: 0, pending: 0, egresos: 0 };

  state.payments.forEach((p) => {
    if (p.product === "descongel") stats.descongel += p.quantity;
    if (p.product === "multidol400") stats.multi400 += p.quantity;
    if (p.product === "multidol800") stats.multi800 += p.quantity;
    if (p.status === "pendiente") stats.pending += 1;
    stats.egresos += p.totalAmount || 0;
  });

  const movementEgresos = state.movements
    .filter((m) => m.type === "egreso")
    .reduce((acc, m) => acc + (m.amount || 0), 0);

  stats.egresos += movementEgresos;

  const reintegros = state.movements
    .filter((m) => m.type === "reintegro")
    .reduce((acc, m) => acc + (m.amount || 0), 0);

  const legacyReintegros = state.payments.reduce((acc, p) => acc + (p.reimbursedAmount || 0), 0);
  const totalReintegros = reintegros + legacyReintegros;
  const available = state.budget + totalReintegros - stats.egresos;
  const usagePercent = (stats.egresos / state.budget) * 100;

  document.getElementById("stat-descongel").textContent = stats.descongel;
  document.getElementById("stat-multi400").textContent = stats.multi400;
  document.getElementById("stat-multi800").textContent = stats.multi800;
  document.getElementById("stat-pending").textContent = stats.pending;

  document.getElementById("kpi-available").textContent = utils.fmtMoney(available);
  document.getElementById("kpi-egresos").textContent = `Egresos: ${utils.fmtMoney(stats.egresos)}`;

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
  }
};
