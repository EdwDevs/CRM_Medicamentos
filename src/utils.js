// Utility functions for formatting and helpers
export const fmt = (n) => new Intl.NumberFormat('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0));

export const fmtDate = (d) => {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : new Date(d);
  return isNaN(date) ? '—' : date.toLocaleDateString('es-CO', {day:'2-digit',month:'short',year:'numeric'});
};

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : new Date(d);
  return isNaN(date) ? '—' : date.toLocaleString('es-CO', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
};

export const fmtCurrency = (n) => fmt(n);

// DOM helpers
export const $ = (s, p=document) => p.querySelector(s);
export const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

// Normalization functions
export const normalizePayment = (d) => {
  const rawStatus = (d.status ?? 'pendiente').toString().trim().toLowerCase();
  const status = rawStatus === 'procesado' ? 'procesado' : 'pendiente';
  return {
    pharmacy: (d.pharmacy || d.pharmacia || d.farmacia || '').toString().trim(),
    product: (d.product || d.producto || 'descongel').toString().trim().toLowerCase(),
    quantity: Number(d.quantity || d.cantidad || 1),
    unitPrice: Number(d.unitPrice || d.unitario || d.precioUnitario || 0),
    totalAmount: Number(d.totalAmount || d.total || (Number(d.quantity||1) * Number(d.unitPrice||d.unitario||0))),
    date: d.date || d.fecha || null,
    status,
    notes: (d.notes || d.notas || '').toString(),
    reimbursedAmount: Number(d.reimbursedAmount || d.reintegro || 0),
    companyContribution: Number(d.companyContribution || d.aporteEmpresa || 0),
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
};

export const normalizeCash = (d) => ({
  type: (d.type || d.tipo || 'egreso').toString().trim().toLowerCase(),
  amount: Number(d.amount || d.monto || 0),
  date: d.date || d.fecha || null,
  referencePaymentIds: Array.isArray(d.referencePaymentIds) ? d.referencePaymentIds : (Array.isArray(d.paymentIds) ? d.paymentIds : []),
  notes: (d.notes || d.notas || '').toString(),
});

export const buildReintegroIndex = (allCashMovements) => {
  const reintegroByPayment = {};
  allCashMovements.filter(m => m.type === 'reintegro').forEach(m => {
    (m.referencePaymentIds || []).forEach(id => {
      if (!reintegroByPayment[id]) reintegroByPayment[id] = [];
      reintegroByPayment[id].push(m);
    });
  });
  return reintegroByPayment;
};