import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, getDoc, getDocs,
  writeBatch, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
window.addEventListener('error', e => { const el = document.getElementById('debugStatus'); if (el) el.textContent = 'error: '+e.message; });

// ====== FIREBASE CONFIG (REAL) ======
const firebaseConfig = {
  apiKey: "AIzaSyAaVSb70OFIoX48T9GbLmTcdXOSvKv2pRk",
  authDomain: "zona1561-4de30.firebaseapp.com",
  projectId: "zona1561-4de30",
  storageBucket: "zona1561-4de30.firebasestorage.app",
  messagingSenderId: "451366030738",
  appId: "1:451366030738:web:e638db51fbe24f6a48054b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

try { await signInAnonymously(auth); } catch (e) { console.warn('Auth anon failed', e); }

// ====== CONSTANTS ======
const BUDGET_TOTAL = parseInt(localStorage.getItem('crm_budget') || '500000');
const PAGE_SIZE_DEFAULT = 50;
const PRODUCTS = JSON.parse(localStorage.getItem('crm_products') || '{"descongel":{"name":"Descongel x100","short":"Descongel","icon":"❄️","color":"bg-cyan-100 text-cyan-700"},"multidol400":{"name":"Multidol 400mg","short":"Multidol 400","icon":"💊","color":"bg-emerald-100 text-emerald-700"},"multidol800":{"name":"Multidol 800mg","short":"Multidol 800","icon":"💊","color":"bg-violet-100 text-violet-700"}}');
const STATUS = {
  pendiente: {label:'Pendiente', short:'PEND', icon:'⏳', badge:'bg-warning-100 text-warning-700'},
  procesado: {label:'Procesado', short:'PROC', icon:'✅', badge:'bg-success-100 text-success-700'}
};

// ====== STATE ======
let allPayments = [];
let allCashMovements = [];
let filteredPayments = [];
let currentPage = 1;
let pageSize = PAGE_SIZE_DEFAULT;
const selectedIds = new Set();
let currentModule = 'dashboard';
let drawerMode = null;
let drawerPaymentId = null;
let activeFilters = {};
let savedViews = JSON.parse(localStorage.getItem('crm_savedViews') || '{}');
let columnsConfig = JSON.parse(localStorage.getItem('crm_columnsConfig') || '{"fecha":true,"farmacia":true,"producto":true,"cantidad":true,"unitario":true,"total":true,"estado":true,"reintegros":true,"acciones":true}');
let sortState = [];
let sidebarCollapsed = localStorage.getItem('crm_sidebarCollapsed') === 'true';
let trendChart = null, productChart = null, pharmacyChart = null, statusChart = null;
let reintegroByPayment = {};
let unsubPayments = null, unsubCash = null;

// ====== DOM HELPERS ======
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));
const fmt = n => new Intl.NumberFormat('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0));
function fmtDate(d) {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : new Date(d);
  return isNaN(date) ? '—' : date.toLocaleDateString('es-CO', {day:'2-digit',month:'short',year:'numeric'});
}
function fmtDateTime(d) {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : new Date(d);
  return isNaN(date) ? '—' : date.toLocaleString('es-CO', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ====== NORMALIZATION ======
function normalizePayment(d) {
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
}
function normalizeCash(d) {
  return {
    type: (d.type || d.tipo || 'egreso').toString().trim().toLowerCase(),
    amount: Number(d.amount || d.monto || 0),
    date: d.date || d.fecha || null,
    referencePaymentIds: Array.isArray(d.referencePaymentIds) ? d.referencePaymentIds : (Array.isArray(d.paymentIds) ? d.paymentIds : []),
    notes: (d.notes || d.notas || '').toString(),
  };
}
function buildReintegroIndex() {
  reintegroByPayment = {};
  allCashMovements.filter(m => m.type === 'reintegro').forEach(m => {
    (m.referencePaymentIds || []).forEach(id => {
      if (!reintegroByPayment[id]) reintegroByPayment[id] = [];
      reintegroByPayment[id].push(m);
    });
  });
}

// ====== TOAST ======
function toast(msg, type='') {
  const c = $('#toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div class="flex-1 text-sm">${msg}</div><button class="text-surface-400 hover:text-surface-600" onclick="this.parentElement.remove()">×</button>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
window.toast = toast;

// ====== MODULE SWITCHING ======
function switchModule(tab) {
  currentModule = tab;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  const titles = {dashboard:'Dashboard',payments:'Pagos',pharmacies:'Farmacias',reintegros:'Reintegros',reports:'Reportes',settings:'Configuración'};
  $('#pageTitle').textContent = titles[tab] || tab;
  ['dashboard','payments','pharmacies','reintegros','reports','settings'].forEach(t => {
    const el = $('#panel-' + t);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
  closeDrawer();
  renderModule(tab);
}
window.switchModule = switchModule;

function renderModule(tab) {
  if (tab === 'dashboard') renderDashboard();
  else if (tab === 'payments') { renderAdvancedFilters(); renderPaymentsGrid(); }
  else if (tab === 'pharmacies') renderPharmacies();
  else if (tab === 'reintegros') renderReintegros();
  else if (tab === 'reports') renderReports();
  else if (tab === 'settings') renderSettings();
}

// ====== SIDEBAR NAV ======
$$('.nav-item[data-tab]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); switchModule(n.dataset.tab); }));

// ====== MOBILE MENU / SIDEBAR TOGGLE ======
$('#sidebarToggle').addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('crm_sidebarCollapsed', sidebarCollapsed);
  $('#appShell').classList.toggle('sidebar-collapsed', sidebarCollapsed);
});
$('#mobileMenuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('mobile-open'));
$('#sidebarOverlay')?.remove?.();

// ====== THEME ======
function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  $('#iconSun').classList.toggle('hidden', t !== 'dark');
  $('#iconMoon').classList.toggle('hidden', t === 'dark');
  localStorage.setItem('crm_theme', t);
}
const savedTheme = localStorage.getItem('crm_theme') || 'light';
applyTheme(savedTheme);
$('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'));

// ====== USER MENU ======
$('#userMenuBtn').addEventListener('click', e => { e.stopPropagation(); $('#userMenu').classList.toggle('hidden'); });
document.addEventListener('click', e => { if (!$('#userMenu').contains(e.target) && e.target !== $('#userMenuBtn')) $('#userMenu').classList.add('hidden'); });
$('#signOutBtn').addEventListener('click', () => toast('Sesión cerrada (demo)'));

// ====== GLOBAL SEARCH ======
let searchTimer = null;
$('#globalSearch').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    activeFilters.search = e.target.value.trim();
    applyModuleFilters();
    if (currentModule !== 'payments') switchModule('payments');
  }, 180);
});

// ====== QUICK CREATE ======
$('#quickCreateBtn').addEventListener('click', () => openDrawer('createPayment'));

// ====== DATA LOADING ======
async function loadData() {
  try {
    const [paySnap, cashSnap] = await Promise.all([
      new Promise(res => { const u = onSnapshot(query(collection(db,'payments'), orderBy('date','desc')), s => { allPayments = s.docs.map(d => ({id:d.id, ...normalizePayment(d.data())})); res(s); }, err => { console.error(err); res(null); }); unsubPayments = u; }),
      new Promise(res => { const u = onSnapshot(query(collection(db,'cash_movements'), orderBy('date','desc')), s => { allCashMovements = s.docs.map(d => ({id:d.id, ...normalizeCash(d.data())})); res(s); }, err => { console.error(err); res(null); }); unsubCash = u; }),
    ]);
    buildReintegroIndex();
    applyModuleFilters();
    renderAllNavBadges();
    renderModule(currentModule);
    toast('Sincronizado', 'success');
    if (document.getElementById('debugStatus')) { document.getElementById('debugStatus').textContent = 'loaded '+allPayments.length+' pagos'; }
  } catch(e) {
    console.error('loadData error', e);
    toast('Error cargando datos', 'error');
  }
}
window.loadData = loadData;

function renderAllNavBadges() {
  $('#navCountPayments').textContent = allPayments.length;
  $('#navCountReintegros').textContent = allCashMovements.filter(m => m.type === 'reintegro').length;
  const pharmacies = new Set(allPayments.map(p => p.pharmacy).filter(Boolean));
  $('#navCountPharmacies').textContent = pharmacies.size;
}

// ====== DASHBOARD ======
function renderDashboard() {
  const period = parseInt($('#dashPeriod').value);
  const cutoff = Date.now() - period * 86400000;
  const recent = allPayments.filter(p => { const t = p.date?.toDate ? p.date.toDate() : new Date(p.date); return t >= cutoff; });
  const totalEgresos = recent.reduce((a,p) => a + p.totalAmount, 0);
  const totalReintegros = recent.filter(m => m.type === 'reintegro' && (() => { const t = m.date?.toDate ? m.date.toDate() : new Date(m.date); return t >= cutoff; })()).reduce((a,m) => a + m.amount, 0);
  const uso = totalEgresos - totalReintegros;
  const pctUso = BUDGET_TOTAL ? Math.min(100, Math.round((uso / BUDGET_TOTAL) * 100)) : 0;
  const pendientes = recent.filter(p => p.status === 'pendiente').length;
  const disponibles = BUDGET_TOTAL - uso;

  $('#kpiGrid').innerHTML = `
    <div class="bg-white rounded-xl border border-surface-200 p-5 shadow-card"><p class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Egresos</p><p class="text-2xl font-extrabold text-surface-900 mt-1">${fmt(totalEgresos)}</p><p class="text-xs text-surface-500 mt-1">${recent.length} pagos</p></div>
    <div class="bg-white rounded-xl border border-surface-200 p-5 shadow-card"><p class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Reintegros</p><p class="text-2xl font-extrabold text-success-600 mt-1">${fmt(totalReintegros)}</p></div>
    <div class="bg-white rounded-xl border border-surface-200 p-5 shadow-card"><p class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Uso de fondo</p><p class="text-2xl font-extrabold text-brand-600 mt-1">${pctUso}%</p><div class="mt-2 h-2 bg-surface-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500" style="width:${pctUso}%"></div></div></div>
    <div class="bg-white rounded-xl border border-surface-200 p-5 shadow-card"><p class="text-xs font-semibold text-surface-500 uppercase tracking-wider">Disponible</p><p class="text-2xl font-extrabold ${disponibles<0?'text-danger-600':'text-surface-900'} mt-1">${fmt(disponibles)}</p><p class="text-xs ${pendientes>0?'text-warning-600':'text-surface-500'} mt-1">${pendientes} pendientes</p></div>
  `;

  // Charts
  if (trendChart) trendChart.destroy();
  if (productChart) productChart.destroy();
  const byMonth = {};
  recent.forEach(p => { const t = p.date?.toDate ? p.date.toDate() : new Date(p.date); const k = t.toLocaleDateString('es-CO', {month:'short'}); byMonth[k] = (byMonth[k] || 0) + p.totalAmount; });
  trendChart = new Chart($('#trendChart'), {type:'line', data:{labels:Object.keys(byMonth), datasets:[{label:'Egresos', data:Object.values(byMonth), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.1)', tension:.3, fill:true}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}}});

  const byProduct = {};
  recent.forEach(p => { const k = (PRODUCTS[p.product]?.short || p.product); byProduct[k] = (byProduct[k] || 0) + p.totalAmount; });
  productChart = new Chart($('#productChart'), {type:'doughnut', data:{labels:Object.keys(byProduct), datasets:[{data:Object.values(byProduct), backgroundColor:['#06b6d4','#22c55e','#8b5cf6','#f59e0b','#ec4899']}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right'}}}});

  $('#dashRecentList').innerHTML = recent.slice(0,8).map(p => `
    <div class="flex items-center justify-between py-2 border-b border-surface-100 cursor-pointer hover:bg-surface-50 px-2 rounded" onclick="openDrawer('viewPayment','${p.id}')">
      <div class="flex items-center gap-3 min-w-0">
        <span class="badge ${STATUS[p.status]?.badge || ''}">${STATUS[p.status]?.short || '?'}</span>
        <div class="min-w-0"><p class="text-sm font-medium truncate">${p.pharmacy}</p><p class="text-xs text-surface-500">${fmtDate(p.date)}</p></div>
      </div>
      <span class="font-mono font-semibold">${fmt(p.totalAmount)}</span>
    </div>
  `).join('') || '<p class="text-sm text-surface-500 text-center py-4">Sin pagos en el período</p>';
}
window.renderDashboard = renderDashboard;

$('#dashPeriod').addEventListener('change', renderDashboard);

// ====== GRID COLUMNS ======
const GRID_COLUMNS = [
  {key:'fecha', label:'Fecha', width:'100px', sortable:true},
  {key:'farmacia', label:'Farmacia', width:'minmax(180px,1fr)', sortable:true},
  {key:'producto', label:'Producto', width:'150px'},
  {key:'cantidad', label:'Cant.', width:'80px', align:'right', sortable:true, type:'number'},
  {key:'unitario', label:'Unitario', width:'120px', align:'right', sortable:true, type:'number'},
  {key:'total', label:'Total', width:'130px', align:'right', sortable:true, type:'number'},
  {key:'estado', label:'Estado', width:'120px', align:'center', sortable:true},
  {key:'reintegros', label:'Reintegros', width:'130px', align:'right'},
  {key:'acciones', label:'', width:'60px', align:'center'},
];

function renderCell(p, col) {
  if (col.key === 'fecha') return fmtDate(p.date);
  if (col.key === 'farmacia') return `<span class="truncate">${p.pharmacy || '—'}</span>`;
  if (col.key === 'producto') { const pr = PRODUCTS[p.product] || {short:p.product, color:'bg-surface-100 text-surface-600'}; return `<span class="badge ${pr.color}">${pr.short}</span>`; }
  if (col.key === 'cantidad') return p.quantity;
  if (col.key === 'unitario') return `<span class="font-mono">${fmt(p.unitPrice)}</span>`;
  if (col.key === 'total') return `<span class="font-mono font-semibold">${fmt(p.totalAmount)}</span>`;
  if (col.key === 'estado') return `<span class="badge ${STATUS[p.status]?.badge || ''}">${STATUS[p.status]?.short || p.status}</span>`;
  if (col.key === 'reintegros') { const r = reintegroByPayment[p.id] || []; const t = r.reduce((a,x)=>a+x.amount,0); return t > 0 ? `<span class="font-mono text-success-600">${fmt(t)}</span>` : '<span class="text-surface-400 font-mono">—</span>'; }
  if (col.key === 'acciones') return `<button class="p-1 rounded hover:bg-surface-100" onclick="event.stopPropagation();openDrawer('viewPayment','${p.id}')" aria-label="Ver"><svg class="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>`;
  return '';
}

function renderGridHeader() {
  const visible = GRID_COLUMNS.filter(c => columnsConfig[c.key] !== false);
  const totalFlex = visible.filter(c => c.width && c.width.startsWith('minmax')).length;
  const fixedTotal = visible.filter(c => !c.width.startsWith('minmax')).reduce((a,c)=>a+parseInt(c.width),0);
  const flexWidth = `minmax(120px, 1fr)`;
  $('#gridHeader').innerHTML = visible.map(col => {
    const w = col.width.startsWith('minmax') ? flexWidth : col.width;
    return `<div class="grid-cell" style="width:${w};justify-content:${col.align==='right'?'flex-end':col.align==='center'?'center':'flex-start'};" data-key="${col.key}">
      <div class="flex items-center gap-1.5 w-full">
        <span class="truncate">${col.label}</span>
        ${col.sortable ? `<button class="sort-btn text-surface-400 hover:text-surface-700 p-0.5" data-sort="${col.key}" aria-label="Ordenar por ${col.label}"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M3 12h18M3 20h18"/></svg></button>` : ''}
      </div>
    </div>`;
  }).join('');
  $$('#gridHeader .sort-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); toggleSort(btn.dataset.sort, e.shiftKey); }));
}
window.renderGridHeader = renderGridHeader;

function toggleSort(key, multi) {
  const idx = sortState.findIndex(s => s.key === key);
  if (idx >= 0) { sortState[idx].dir = sortState[idx].dir === 'asc' ? 'desc' : 'asc'; if (!multi) sortState = [sortState[idx]]; }
  else { if (!multi) sortState = []; sortState.push({key, dir:'asc'}); }
  applyModuleFilters(); renderGridHeader(); updateSortIndicators();
}
window.toggleSort = toggleSort;

function applySort(arr) {
  if (!sortState.length) return arr;
  return [...arr].sort((a,b) => {
    for (const {key, dir} of sortState) {
      let va = key === 'farmacia' ? a.pharmacy : a[key];
      let vb = key === 'farmacia' ? b.pharmacy : b[key];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb||'').toLowerCase(); }
      if (va == null && vb == null) continue;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

function updateSortIndicators() {
  $$('#gridHeader .sort-btn').forEach(btn => {
    const sort = sortState.find(s => s.key === btn.dataset.sort);
    const svg = btn.querySelector('svg');
    if (sort) {
      btn.classList.add('text-brand-600'); btn.classList.remove('text-surface-400');
      svg.innerHTML = sort.dir === 'asc' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 9l7 7 7-7"/>';
    } else {
      btn.classList.remove('text-brand-600'); btn.classList.add('text-surface-400');
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M3 12h18M3 20h18"/>';
    }
  });
}


// ====== FILTROS ======
function applyModuleFilters() {
  filteredPayments = allPayments.filter(p => {
    if (activeFilters.product && p.product !== activeFilters.product) return false;
    if (activeFilters.pharmacy && p.pharmacy !== activeFilters.pharmacy) return false;
    if (activeFilters.status && p.status !== activeFilters.status) return false;
    if (activeFilters.month) {
      const t = p.date?.toDate ? p.date.toDate() : new Date(p.date);
      const key = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0');
      if (key !== activeFilters.month) return false;
    }
    if (activeFilters.dateFrom) {
      const t = p.date?.toDate ? p.date.toDate() : new Date(p.date);
      if (t < new Date(activeFilters.dateFrom + 'T00:00:00')) return false;
    }
    if (activeFilters.dateTo) {
      const t = p.date?.toDate ? p.date.toDate() : new Date(p.date);
      if (t > new Date(activeFilters.dateTo + 'T23:59:59')) return false;
    }
    if (activeFilters.amountMin && p.totalAmount < Number(activeFilters.amountMin)) return false;
    if (activeFilters.amountMax && p.totalAmount > Number(activeFilters.amountMax)) return false;
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      const hay = (p.pharmacy + ' ' + (p.notes||'') + ' ' + p.id).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  filteredPayments = applySort(filteredPayments);
  currentPage = 1;
  if (currentModule === 'payments') renderPaymentsGrid();
  $('#gridResultCount').textContent = filteredPayments.length + ' registros';
}
window.applyModuleFilters = applyModuleFilters;

function renderAdvancedFilters() {
  const pharmOptions = [...new Set(allPayments.map(p => p.pharmacy).filter(Boolean))].sort();
  $('#advancedFilters').innerHTML = `
    <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">Producto</label>
      <select class=\"input-editorial text-sm\" data-filter=\"product\"><option value=\"\">Todos</option>
      ${Object.entries(PRODUCTS).map(([k,v])=>`<option value=\"${k}\">${v.icon} ${v.name}</option>`).join('')}</select></div>
    <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">Farmacia</label>
      <select class=\"input-editorial text-sm\" data-filter=\"pharmacy\"><option value=\"\">Todas</option>
      ${pharmOptions.map(ph=>`<option value=\"${ph}\">${ph}</option>`).join('')}</select></div>
    <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">Estado</label>
      <select class=\"input-editorial text-sm\" data-filter=\"status\"><option value=\"\">Todos</option><option value=\"pendiente\">\u23f3 Pendiente</option><option value=\"procesado\">\u2705 Procesado</option></select></div>
    <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">Mes</label>
      <select class=\"input-editorial text-sm\" data-filter=\"month\"><option value=\"\">Cualquier mes</option>
      ${Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);const val=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');return `<option value=\"${val}\">${d.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>`;}).join('')}</select></div>
    <div class=\"grid grid-cols-2 gap-2\">\n      <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">Desde</label><input type=\"date\" class=\"input-editorial text-sm\" data-filter=\"dateFrom\"></div>\n      <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">Hasta</label><input type=\"date\" class=\"input-editorial text-sm\" data-filter=\"dateTo\"></div>\n    </div>\n    <div class=\"grid grid-cols-2 gap-2\">\n      <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">M\u00edn $</label><input type=\"number\" class=\"input-editorial text-sm\" data-filter=\"amountMin\" step=\"100\" min=\"0\"></div>\n      <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">M\u00e1x $</label><input type=\"number\" class=\"input-editorial text-sm\" data-filter=\"amountMax\" step=\"100\" min=\"0\"></div>\n    </div>\n    <div><label class=\"block text-xs font-medium text-surface-500 mb-1\">B\u00fasqueda</label>\n      <input type=\"text\" class=\"input-editorial text-sm\" data-filter=\"search\" placeholder=\"Farmacia, notas, ID...\"></div>`;
  $$('#advancedFilters [data-filter]').forEach(el => {
    if (activeFilters[el.dataset.filter] !== undefined) el.value = activeFilters[el.dataset.filter];
    el.addEventListener('change', () => {
      const k = el.dataset.filter, v = el.value;
      if (v === '') delete activeFilters[k]; else activeFilters[k] = v;
      applyModuleFilters();
    });
  });
  renderSavedViewsDropdown();
}

// ====== SAVED VIEWS ======
function renderSavedViewsDropdown() {
  $('#savedViews').innerHTML = '<option value=\"\">\u2014 Vista \u2014</option>' + Object.keys(savedViews).map(n=>`<option value=\"${n}\">${n}</option>`).join('');
}
$('#savedViews').addEventListener('change', () => {
  const v = savedViews[$('#savedViews').value]; if (!v) return;
  activeFilters = {...v.filters}; sortState = v.sort ? [...v.sort] : [];
  columnsConfig = {...columnsConfig, ...(v.columns||{})}; pageSize = v.pageSize || PAGE_SIZE_DEFAULT;
  renderAdvancedFilters(); renderGridHeader(); renderPaymentsGrid();
});
$('#saveViewBtn').addEventListener('click', () => {
  const n = prompt('Nombre de la vista:'); if (!n) return;
  savedViews[n] = {filters:{...activeFilters}, sort:[...sortState], columns:{...columnsConfig}, pageSize};
  localStorage.setItem('crm_savedViews', JSON.stringify(savedViews));
  renderSavedViewsDropdown(); toast('Vista \"'+n+'\" guardada','success');
});
$('#deleteViewBtn').addEventListener('click', () => {
  const n = $('#savedViews').value; if (!n) return toast('Selecciona una vista','error');
  if (!confirm('¿Borrar vista \"'+n+'\"?')) return;
  delete savedViews[n];
  localStorage.setItem('crm_savedViews', JSON.stringify(savedViews));
  renderSavedViewsDropdown(); toast('Vista eliminada');
});
$('#clearFiltersBtn').addEventListener('click', () => { activeFilters = {}; renderAdvancedFilters(); applyModuleFilters(); });

// ====== GRID BODY ======
function renderPaymentsGrid() {
  const visible = GRID_COLUMNS.filter(c => columnsConfig[c.key] !== false);
  const start = (currentPage-1)*pageSize;
  const pageData = filteredPayments.slice(start, start+pageSize);
  renderGridHeader();
  if (!pageData.length) {
    $('#gridBody').innerHTML='';
    $('#gridEmptyState').classList.remove('hidden');
    $('#statusBar').style.display='none';
    return;
  }
  $('#gridEmptyState').classList.add('hidden');
  $('#statusBar').style.display='flex';
  const density = $('#densitySelect')?.value || 'standard';
  $('#gridContainer').classList.toggle('density-compact', density==='compact');
  $('#gridContainer').classList.toggle('density-comfortable', density==='comfortable');
  const widths = visible.map(c => c.width.startsWith('minmax') ? 'minmax(120px,1fr)' : c.width);
  $('#gridBody').innerHTML = pageData.map(p => {
    const sel = selectedIds.has(p.id) ? ' selected' : '';
    return `<div class=\"grid-row${sel}\" data-id=\"${p.id}\" tabindex=\"0\" onclick=\"handleRowClick('${p.id}',event)\">${
      visible.map((col,i)=>`<div class=\"grid-cell\" style=\"width:${widths[i]};justify-content:${col.align==='right'?'flex-end':col.align==='center'?'center':'flex-start'};\">${renderCell(p,col)}</div>`).join('')}
      <div class=\"grid-cell\" style=\"width:60px;justify-content:center;\"><input type=\"checkbox\" class=\"w-4 h-4 rounded border-surface-300 text-brand-600\" ${selectedIds.has(p.id)?'checked':''} onclick=\"event.stopPropagation();toggleSelect('${p.id}')\" aria-label=\"Seleccionar\"></div></div>`;
  }).join('');
  updatePagination();
  $('#gridStatusText').textContent = `Mostrando ${start+1}\u2013${Math.min(start+pageSize, filteredPayments.length)} de ${filteredPayments.length}`;
}
window.renderPaymentsGrid = renderPaymentsGrid;

function handleRowClick(id, e) {
  if (e.target.closest('button,input,select,a')) return;
  if (e.ctrlKey || e.metaKey) { selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id); updateSelectionUI(); return; }
  if (e.shiftKey) { selectedIds.add(id); updateSelectionUI(); return; }
  openDrawer('viewPayment', id);
}
window.handleRowClick = handleRowClick;

function toggleSelect(id) { selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id); updateSelectionUI(); }
window.toggleSelect = toggleSelect;

function updateSelectionUI() {
  $$('#gridBody .grid-row').forEach(r => r.classList.toggle('selected', selectedIds.has(r.dataset.id)));
  const count = selectedIds.size;
  if (count>0) {
    const existing = $('#bulkBar'); if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.id='bulkBar';
    bar.className='fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-600 text-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-3 z-50';
    bar.innerHTML = `<span class=\"text-sm font-medium\">${count} seleccionados</span>
      <button class=\"text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg\" onclick=\"bulkSetStatus('procesado')\">\u2705 Procesar</button>
      <button class=\"text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg\" onclick=\"bulkSetStatus('pendiente')\">\u23f3 Pendiente</button>
      <button class=\"text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg\" onclick=\"bulkExport()\">\ud83d\udce5 CSV</button>
      <button class=\"text-xs bg-danger-500 hover:bg-danger-600 px-2.5 py-1 rounded-lg\" onclick=\"bulkDelete()\">\ud83d\uddd1\ufe0f Eliminar</button>
      <button class=\"text-xs hover:bg-white/20 px-1.5 py-1 rounded\" onclick=\"clearSelection()\">\u00d7</button>`;
    document.body.appendChild(bar);
  } else { $('#bulkBar')?.remove(); }
}
window.updateSelectionUI = updateSelectionUI;
function clearSelection() { selectedIds.clear(); updateSelectionUI(); }
window.clearSelection = clearSelection;

async function bulkSetStatus(s) {
  if (!selectedIds.size) return;
  const batch = writeBatch(db);
  selectedIds.forEach(id => batch.update(doc(db,'payments',id), {status:s}));
  await batch.commit(); toast(`${selectedIds.size} pagos → ${s}`,'success'); clearSelection();
}
window.bulkSetStatus = bulkSetStatus;

async function bulkDelete() {
  if (!selectedIds.size || !confirm(`¿Eliminar ${selectedIds.size} pagos?`)) return;
  const batch = writeBatch(db);
  selectedIds.forEach(id => batch.delete(doc(db,'payments',id)));
  await batch.commit(); toast('Pagos eliminados','success'); clearSelection();
}
window.bulkDelete = bulkDelete;

function bulkExport() {
  const rows = [...selectedIds].map(id => {
    const p = allPayments.find(p=>p.id===id);
    const r = reintegroByPayment[id]||[]; const rt = r.reduce((a,x)=>a+x.amount,0);
    return [fmtDate(p.date), p.pharmacy, PRODUCTS[p.product]?.name||p.product, p.quantity, p.unitPrice, p.totalAmount, STATUS[p.status]?.label||p.status, rt>0?rt:'', (p.notes||'').replace(/\"/g,'\"\"')];
  });
  downloadCSV(rows,'pagos_seleccionados');
  toast('CSV exportado','success');
}
window.bulkExport = bulkExport;

function csvRow(p) {
  const r = reintegroByPayment[p.id]||[]; const rt = r.reduce((a,x)=>a+x.amount,0);
  return [fmtDate(p.date), p.pharmacy, PRODUCTS[p.product]?.name||p.product, p.quantity, p.unitPrice, p.totalAmount, STATUS[p.status]?.label||p.status, rt>0?rt:'', (p.notes||'').replace(/\"/g,'\"\"')];
}
function downloadCSV(rows, name) {
  const headers = ['Fecha','Farmacia','Producto','Cant','Unitario','Total','Estado','Reintegros','Notas'];
  const csv = '\\\\uFEFF' + [headers.join(','), ...rows.map(r=>r.map(v=>`\"${v}\"`).join(','))].join('\\\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = name+'_'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
}
$('#exportGridBtn').addEventListener('click', () => { if (!filteredPayments.length) return toast('Sin datos','error'); downloadCSV(filteredPayments.map(csvRow),'pagos_filtrados'); toast('CSV exportado','success'); });

// ====== PAGINATION ======
function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  $('#pageInfo').textContent = `Página ${currentPage} de ${totalPages}`;
  $('#prevPage').disabled = currentPage <= 1;
  $('#nextPage').disabled = currentPage >= totalPages;
  pageSize = parseInt($('#pageSizeSelect').value);
}
$('#prevPage')?.addEventListener('click', () => { if (currentPage>1) { currentPage--; renderPaymentsGrid(); } });
$('#nextPage')?.addEventListener('click', () => { const tp = Math.ceil(filteredPayments.length/pageSize); if (currentPage<tp) { currentPage++; renderPaymentsGrid(); } });
$('#pageSizeSelect')?.addEventListener('change', () => { pageSize = parseInt($('#pageSizeSelect').value); currentPage=1; renderPaymentsGrid(); });
$('#densitySelect')?.addEventListener('change', renderPaymentsGrid);

// Columns dropdown
$('#columnsBtn')?.addEventListener('click', e => { e.stopPropagation(); $('#columnsDropdown').classList.toggle('hidden'); renderColumnsDropdown(); });
document.addEventListener('click', e => { if (!e.target.closest('#columnsBtn,#columnsDropdown')) $('#columnsDropdown')?.classList.add('hidden'); });
function renderColumnsDropdown() {
  $('#columnsDropdown').innerHTML = GRID_COLUMNS.map(col => `
    <label class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-50 cursor-pointer">
      <input type="checkbox" class="w-4 h-4 rounded border-surface-300 text-brand-600" ${columnsConfig[col.key] !== false ? 'checked' : ''} onchange="toggleColumn('${col.key}', this.checked)">
      <span class="text-sm text-surface-700">${col.label}</span>
    </label>`).join('');
}
function toggleColumn(key, visible) {
  if (visible) delete columnsConfig[key]; else columnsConfig[key] = false;
  localStorage.setItem('crm_columnsConfig', JSON.stringify(columnsConfig));
  renderGridHeader();
  if (currentModule === 'payments') renderPaymentsGrid();
}

// ====== DRAWER ======
function openDrawer(mode, paymentId) {
  drawerMode = mode; drawerPaymentId = paymentId || null;
  const titles = {createPayment:'Nuevo Pago', createReintegro:'Nuevo Reintegro', viewPayment:'Detalle del Pago', editPayment:'Editar Pago'};
  $('#drawerTitle').textContent = titles[mode] || 'Detalle';
  const showTabs = (mode === 'viewPayment' || mode === 'editPayment');
  $('#drawerTabs').classList.toggle('hidden', !showTabs);
  if (showTabs) {
    $('#drawerTabs').innerHTML = ['detail','history','reintegros','notes'].map((t,i)=>`<button class=\"drawer-tab px-3 py-2.5 text-sm font-medium border-b-2 ${i===0?'border-brand-600 text-brand-600':'border-transparent text-surface-500 hover:text-surface-700'}\" data-tab=\"${t}\">${{detail:'Detalle',history:'Historial',reintegros:'Reintegros',notes:'Notas'}[t]}</button>`).join('');
    $$('#drawerTabs .drawer-tab').forEach(b => b.addEventListener('click', () => { $$('#drawerTabs .drawer-tab').forEach(x=>{ x.classList.remove('border-brand-600','text-brand-600'); x.classList.add('border-transparent','text-surface-500'); }); b.classList.add('border-brand-600','text-brand-600'); renderDrawerTabContent(b.dataset.tab); }));
  }
  renderDrawerTabContent('detail');
  $('#drawer').classList.add('open');
  $('#drawerOverlay').classList.add('open');
}
window.openDrawer = openDrawer;
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerOverlay').classList.remove('open'); drawerMode=null; drawerPaymentId=null; }
window.closeDrawer = closeDrawer;
$('#drawerOverlay').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key==='Escape') closeDrawer(); });
function renderDrawerTabContent(tab) {
  if (drawerMode==='createPayment') return renderCreatePaymentForm();
  if (drawerMode==='createReintegro') return renderCreateReintegroForm();
  if (drawerMode==='viewPayment' || drawerMode==='editPayment') {
    if (tab==='detail') renderPaymentDetail(drawerPaymentId);
    else if (tab==='history') renderPaymentHistory(drawerPaymentId);
    else if (tab==='reintegros') renderPaymentReintegros(drawerPaymentId);
    else if (tab==='notes') renderPaymentNotes(drawerPaymentId);
  }
}

// Auto‑load data on page start

// ====== PHARMACIES ======
function renderPharmacies() {
  const pharmContent = $('#pharmaciesContent');
  if (!pharmContent) return;
  pharmContent.innerHTML = `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-surface-900 mb-4">Mapa de Farmacias</h2>
      <p class="text-surface-500">Esta sección muestra el resumen por farmacia: volumen, salud, último pago, etc.</p>
      <div class="mt-4">
        <button id="refreshPharmaciesBtn" class="btn-primary">Actualizar datos</button>
      </div>
    </div>`;
  $('#refreshPharmaciesBtn')?.addEventListener('click', () => {
    toast('Recargando farmacias...', 'info');
    // TODO: implement actual refresh
    setTimeout(() => toast('Farmacias actualizadas', 'success'), 800);
  });
}
window.renderPharmacies = renderPharmacies;

// ====== REINTEGROS ======
function renderReintegros() {
  const reiContent = $('#reintegrosContent');
  if (!reiContent) return;
  reiContent.innerHTML = `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-surface-900 mb-4">Movimientos de Reintegro</h2>
      <p class="text-surface-500">Lista de reintegros aplicados a pagos.</p>
      <div class="mt-4">
        <button id="refreshReintegrosBtn" class="btn-primary">Actualizar</button>
      </div>
    </div>`;
  $('#refreshReintegrosBtn')?.addEventListener('click', () => {
    toast('Recargando reintegros...', 'info');
    setTimeout(() => toast('Reintegros actualizados', 'success'), 800);
  });
}
window.renderReintegros = renderReintegros;

// ====== REPORTS ======
function renderReports() {
  const repContent = $('#reportsContent');
  if (!repContent) return;
  repContent.innerHTML = `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-surface-900 mb-4">Reportes</h2>
      <p class="text-surface-500">Genera y descarga reportes ejecutivos y operativos.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <button class="btn-primary w-full" onclick="toast('Reporte de ventas por producto')">Ventas por Producto</button>
        <button class="btn-primary w-full" onclick="toast('Reporte de reintegros')">Reporte de Reintegros</button>
        <button class="btn-primary w-full" onclick="toast('Reporte de farmacias top')">Top Farmacias</button>
        <button class="btn-primary w-full" onclick="toast('Reporte de pagos por estado')">Pagos por Estado</button>
      </div>
    </div>`;
}
window.renderReports = renderReports;

// ====== SETTINGS ======
function renderSettings() {
  const setContent = $('#settingsContent');
  if (!setContent) return;
  setContent.innerHTML = `
    <div class="p-6">
      <h2 class="text-2xl font-bold text-surface-900 mb-4">Configuración</h2>
      <div class="space-y-4">
        <div class="border rounded-xl p-4">
          <h3 class="font-semibold text-surface-900 mb-2">Presupuesto</h3>
          <div class="flex items-center gap-2">
            <span class="w-20">Presupuesto mensual:</span>
            <input id="budgetInput" type="number" class="input-editorial w-32" value="${BUDGET_TOTAL}" step="10000">
            <button id="saveBudgetBtn" class="btn-primary btn-sm">Guardar</button>
          </div>
          <p class="text-sm text-surface-500 mt-2">Este presupuesto se usa para alertas de gasto.</p>
        </div>
        <div class="border rounded-xl p-4">
          <h3 class="font-semibold text-surface-900 mb-2">Productos</h3>
          <div id="productsList" class="space-y-2"></div>
          <button id="addProductBtn" class="btn-primary btn-sm w-full">+ Agregar Producto</button>
        </div>
        <div class="border rounded-xl p-4">
          <h3 class="font-semibold text-surface-900 mb-2">Tema y Notificaciones</h3>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="notifyEnabled" class="w-4 h-4" ${localStorage.getItem('crm_notify') === 'true' ? 'checked' : ''}>
            <span>Notificaciones activas</span>
          </label>
        </div>
      </div>
    </div>`;
  // Budget save
  $('#saveBudgetBtn')?.addEventListener('click', () => {
    const val = parseInt($('#budgetInput').value) || 0;
    localStorage.setItem('crm_budget', val);
    BUDGET_TOTAL = val;
    toast('Presupuesto actualizado', 'success');
    renderKPIs(); // update budget KPI
  });
  // Notify toggle
  $('#notifyEnabled')?.addEventListener('change', () => {
    localStorage.setItem('crm_notify', $('#notifyEnabled').checked.toString());
    toast('Preferencia de notificaciones guardada', 'success');
  });
  // Products list render
  renderProductsList();
}
window.renderSettings = renderSettings;

function renderProductsList() {
  const list = $('#productsList');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(PRODUCTS).forEach(([key, prod]) => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 p-2 bg-surface-50 rounded';
    div.innerHTML = `
      <span class="w-10 h-10 flex items-center justify-center rounded-${prod.color.slice(5)}">${prod.icon}</span>
      <div class="flex-1">
        <div class="font-medium">${prod.name}</div>
        <div class="text-xs text-surface-500">${prod.short}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-sm btn-outline" onclick="editProduct('${key}')">Editar</button>
        <button class="btn-sm btn-outline bg-danger-100 text-danger-700 hover:bg-danger-200" onclick="deleteProduct('${key}')">Eliminar</button>
      </div>`;
    list.appendChild(div);
  });
}
window.renderProductsList = renderProductsList;

function editProduct(key) {
  const prod = PRODUCTS[key];
  const name = prompt('Nombre del producto:', prod.name);
  if (!name) return;
  const short = prompt('Siglas cortas:', prod.short);
  if (short === null) return;
  const icon = prompt('Icono (emoji):', prod.icon);
  if (icon === null) return;
  PRODUCTS[key] = { name, short, icon, color: prod.color };
  localStorage.setItem('crm_products', JSON.stringify(PRODUCTS));
  renderProductsList();
  toast('Producto actualizado', 'success');
}

function deleteProduct(key) {
  if (!confirm(`¿Eliminar producto ${PRODUCTS[key]?.name}?`)) return;
  delete PRODUCTS[key];
  localStorage.setItem('crm_products', JSON.stringify(PRODUCTS));
  renderProductsList();
  toast('Producto eliminado', 'success');
}

// ====== DRAWER FORM FUNCTIONS ======
function renderCreatePaymentForm() {
  return `
    <form id="createPaymentForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-surface-500">Farmacia</label>
        <input id="cpPharmacy" type="text" class="input-editorial w-full mt-1" placeholder="Nombre de la farmacia" required>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-surface-500">Producto</label>
          <select id="cpProduct" class="input-editorial w-full mt-1">
            ${Object.entries(PRODUCTS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-500">Cantidad</label>
          <input id="cpQuantity" type="number" class="input-editorial w-full mt-1" min="1" value="1">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-surface-500">Precio unitario</label>
          <input id="cpUnitPrice" type="number" class="input-editorial w-full mt-1" step="0.01" min="0" value="0">
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-500">Fecha</label>
          <input id="cpDate" type="date" class="input-editorial w-full mt-1" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-surface-500">Notas</label>
        <textarea id="cpNotes" class="input-editorial w-full" rows="3" placeholder="Notas opcionales"></textarea>
      </div>
      <div class="flex justify-end">
        <button type="button" class="btn-secondary mr-2" onclick="closeDrawer()">Cancelar</button>
        <button type="button" class="btn-primary" id="cpSubmitBtn">Guardar Pago</button>
      </div>
    </form>`;
}
window.renderCreatePaymentForm = renderCreatePaymentForm;

function renderCreateReintegroForm() {
  return `
    <form id="createReintegroForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-surface-500">Concepto</label>
        <input id="crConcept" type="text" class="input-editorial w-full mt-1" placeholder="Descripción del reintegro" required>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-surface-500">Monto</label>
          <input id="crAmount" type="number" class="input-editorial w-full mt-1" step="0.01" min="0" value="0">
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-500">Fecha</label>
          <input id="crDate" type="date" class="input-editorial w-full mt-1" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-surface-500">Notas</label>
        <textarea id="crNotes" class="input-editorial w-full" rows="3" placeholder="Notas opcionales"></textarea>
      </div>
      <div class="flex justify-end">
        <button type="button" class="btn-secondary mr-2" onclick="closeDrawer()">Cancelar</button>
        <button type="button" class="btn-primary" id="crSubmitBtn">Guardar Reintegro</button>
      </div>
    </form>`;
}
window.renderCreateReintegroForm = renderCreateReintegroForm;

function renderPaymentDetail(id) {
  const p = allPayments.find(pp => pp.id === id) || {};
  const reintes = (reintegroByPayment[id] || []).reduce((sum, r) => sum + r.amount, 0);
  return `
    <div class="space-y-4">
      <div class="border rounded-xl p-4">
        <h3 class="font-semibold text-surface-900">Detalle del Pago</h3>
        <div class="space-y-2">
          <div class="flex justify-between"><span class="text-surface-500">ID:</span><span class="font-mono">${p.id||'-'}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Farmacia:</span><span>${p.pharmacy||'-'}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Producto:</span><span>${PRODUCTS[p.product]?.name||p.product||'-'}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Cantidad:</span><span>${p.quantity||0}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Precio unitario:</span><span>${fmtCurrency(p.unitPrice||0)}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Total:</span><span class="font-bold">${fmtCurrency(p.totalAmount||0)}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Fecha:</span><span>${fmtDate(p.date||0)}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Estado:</span><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[p.status]?.badge?.includes('bg-success') ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'}">${STATUS[p.status]?.label||p.status}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Reintegros aplicados:</span><span class="font-bold">${fmtCurrency(reintes)}</span></div>
          <div class="flex justify-between"><span class="text-surface-500">Notas:</span><span class="break-all whitespace-pre-wrap">${(p.notes||'').replace(/</g,'<').replace(/>/g,'>')}</span></div>
        </div>
      </div>
      <div class="border rounded-xl p-4 mt-4">
        <h3 class="font-semibold text-surface-900">Acciones</h3>
        <div class="flex items-center gap-2">
          <button id="btnEditPayment" class="btn-primary btn-sm">✏️ Editar Pago</button>
          <button id="btnDeletePayment" class="btn btn-danger btn-sm">🗑️ Eliminar Pago</button>
        </div>
      </div>
    </div>`;
}
window.renderPaymentDetail = renderPaymentDetail;

function renderPaymentHistory(id) {
  const cash = allCashMovements.filter(cm => cm.paymentId === id);
  if (!cash.length) {
    return `<div class="p-6 text-center text-surface-500">No hay movimientos de caja asociados a este pago.</div>`;
  }
  const rows = cash.map(cm => `
    <tr class="border-t">
      <td class="p-2">${fmtDate(cm.date||0)}</td>
      <td class="p-2">${cm.type==='reintegro'?'⏪ Reintegro':'💰 Abono'}</td>
      <td class="p-2 text-right">${fmtCurrency(cm.amount)}</td>
      <td class="p-2">${cm.notes||'-'}</td>
    </tr>`).join('');
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-surface-200">
        <thead class="bg-surface-50">
          <tr><th class="px-4 py-2 text-left text-xs font-medium text-surface-500">Fecha</th><th class="px-4 py-2 text-left text-xs font-medium text-surface-500">Tipo</th><th class="px-4 py-2 text-right text-xs font-medium text-surface-500">Monto</th><th class="px-4 py-2 text-left text-xs font-medium text-surface-500">Notas</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
window.renderPaymentHistory = renderPaymentHistory;

function renderPaymentReintegros(id) {
  const reins = reintegroByPayment[id] || [];
  if (!reins.length) {
    return `<div class="p-6 text-center text-surface-500">No hay reintegros asociados a este pago.</div>`;
  }
  const rows = reins.map(r => `
    <tr class="border-t">
      <td class="p-2">${fmtDate(r.date||0)}</td>
      <td class="p-2">${r.type||'reintegro'}</td>
      <td class="p-2 text-right">${fmtCurrency(r.amount)}</td>
      <td class="p-2">${r.notes||'-'}</td>
    </tr>`).join('');
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-surface-200">
        <thead class="bg-surface-50">
          <tr><th class="px-4 py-2 text-left text-xs font-medium text-surface-500">Fecha</th><th class="px-4 py-2 text-left text-xs font-medium text-surface-500">Tipo</th><th class="px-4 py-2 text-right text-xs font-medium text-surface-500">Monto</th><th class="px-4 py-2 text-left text-xs font-medium text-surface-500">Notas</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
window.renderPaymentReintegros = renderPaymentReintegros;

function renderPaymentNotes(id) {
  const p = allPayments.find(pp => pp.id === id) || {};
  return `
    <div class="space-y-4">
      <div class="border rounded-xl p-4">
        <h3 class="font-semibold text-surface-900">Notas del Pago</h3>
        <p class="whitespace-pre-wrap text-surface-700">${(p.notes||'').replace(/</g,'<').replace(/>/g,'>')}</p>
      </div>
      <div class="border rounded-xl p-4 mt-4">
        <h3 class="font-semibold text-surface-900">Editar Notas</h3>
        <form id="editNotesForm" class="space-y-2">
          <textarea id="editNotesText" class="input-editorial w-full" rows="5">${(p.notes||'').replace(/"/g,'"')}</textarea>
          <div class="flex justify-end">
            <button type="button" class="btn-secondary mr-2" onclick="closeDrawer()">Cancelar</button>
            <button type="button" class="btn-primary" id="saveNotesBtn">Guardar Notas</button>
          </div>
        </form>
      </div>
    </div>`;
}
window.renderPaymentNotes = renderPaymentNotes;

// Hooks for drawer form submissions
document.addEventListener('submit', e => {
  if (e.target.id === 'createPaymentForm') {
    e.preventDefault();
    const pharmacy = $('#cpPharmacy').value.trim();
    const product = $('#cpProduct').value;
    const quantity = parseInt($('#cpQuantity').value) || 1;
    const unitPrice = parseFloat($('#cpUnitPrice').value) || 0;
    const dateStr = $('#cpDate').value;
    const notes = $('#cpNotes').value.trim();
    if (!pharmacy) { toast('Farmacia requerida', 'error'); return; }
    const totalAmount = quantity * unitPrice;
    const newPayment = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      pharmacy,
      product,
      quantity,
      unitPrice,
      totalAmount,
      date: dateStr ? new Date(dateStr) : Timestamp.now(),
      status: 'pendiente',
      notes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    addDoc(collection(db, 'payments'), newPayment)
      .then(() => {
        toast('Pago creado exitosamente', 'success');
        closeDrawer();
        // reload data to reflect new payment
        loadData();
      })
      .catch(err => {
        console.error(err);
        toast('Error al crear pago', 'error');
      });
  }
  if (e.target.id === 'createReintegroForm') {
    e.preventDefault();
    const concept = $('#crConcept').value.trim();
    const amount = parseFloat($('#crAmount').value) || 0;
    const dateStr = $('#crDate').value;
    const notes = $('#crNotes').value.trim();
    if (!concept) { toast('Concepto requerido', 'error'); return; }
    if (amount <= 0) { toast('Monto debe ser mayor a cero', 'error'); return; }
    if (!drawerPaymentId) { toast('No se pudo identificar el pago asociado', 'error'); return; }
    const newReintegro = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      paymentId: drawerPaymentId,
      concept,
      amount,
      date: dateStr ? new Date(dateStr) : Timestamp.now(),
      type: 'reintegro',
      notes,
      createdAt: Timestamp.now()
    };
    addDoc(collection(db, 'cash_movements'), newReintegro)
      .then(() => {
        toast('Reintegro guardado exitosamente', 'success');
        closeDrawer();
        loadData();
      })
      .catch(err => {
        console.error(err);
        toast('Error al guardar reintegro', 'error');
      });
  }
  if (e.target.id === 'editNotesForm') {
    e.preventDefault();
    if (!drawerPaymentId) { toast('No se pudo identificar el pago', 'error'); return; }
    const notes = $('#editNotesText').value.trim();
    updateDoc(doc(db, 'payments', drawerPaymentId), { notes, updatedAt: Timestamp.now() })
      .then(() => {
        toast('Notas actualizadas', 'success');
        closeDrawer();
        loadData();
      })
      .catch(err => {
        console.error(err);
        toast('Error al actualizar notas', 'error');
      });
  }
});

loadData();
