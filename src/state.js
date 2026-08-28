// src/state.js
// Firebase initialization
import { firebaseApp, auth, db } from './firebase/init.js';

// Constants
export const BUDGET_TOTAL = parseInt(localStorage.getItem('crm_budget') || '500000');
export const PAGE_SIZE_DEFAULT = 50;
export const PRODUCTS = JSON.parse(localStorage.getItem('crm_products') || '{\"descongel\":{\"name\":\"Descongel x100\",\"short\":\"Descongel\",\"icon\":\"❄️\",\"color\":\"bg-cyan-100 text-cyan-700\"},\"multidol400\":{\"name\":\"Multidol 400mg\",\"short\":\"Multidol 400\",\"icon\":\"💊\",\"color\":\"bg-emerald-100 text-emerald-700\"},\"multidol800\":{\"name\":\"Multidol 800mg\",\"short\":\"Multidol 800\",\"icon\":\"💊\",\"color\":\"bg-violet-100 text-violet-700\"}}');
export const STATUS = {
  pendiente: {label:'Pendiente', short:'PEND', icon:'⏳', badge:'bg-warning-100 text-warning-700'},
  procesado: {label:'Procesado', short:'PROC', icon:'✅', badge:'bg-success-100 text-success-700'}
};

// State
export let state = {
  allPayments: [],
  allCashMovements: [],
  filteredPayments: [],
  currentPage: 1,
  pageSize: PAGE_SIZE_DEFAULT,
  selectedIds: new Set(),
  currentModule: 'dashboard',
  drawerMode: null,
  drawerPaymentId: null,
  activeFilters: {},
  savedViews: JSON.parse(localStorage.getItem('crm_savedViews') || '{}'),
  columnsConfig: JSON.parse(localStorage.getItem('crm_columnsConfig') || '{\"fecha\":true,\"farmacia\":true,\"producto\":true,\"cantidad\":true,\"unitario\":true,\"total\":true,\"estado\":true,\"reintegros\":true,\"acciones\":true}'),
  sortState: [],
  sidebarCollapsed: localStorage.getItem('crm_sidebarCollapsed') === 'true',
  trendChart: null,
  productChart: null,
  pharmacyChart: null,
  statusChart: null,
  reintegroByPayment: {},
  unsubPayments: null,
  unsubCash: null
};

// State modifier functions
export const buildReintegroIndex = () => {
  state.reintegroByPayment = {};
  state.allCashMovements.filter(m => m.type === 'reintegro').forEach(m => {
    (m.referencePaymentIds || []).forEach(id => {
      if (!state.reintegroByPayment[id]) state.reintegroByPayment[id] = [];
      state.reintegroByPayment[id].push(m);
    });
  });
};

export const applyModuleFilters = () => {
  state.filteredPayments = state.allPayments.filter(p => {
    if (state.activeFilters.product && p.product !== state.activeFilters.product) return false;
    if (state.activeFilters.pharmacy && p.pharmacy !== state.activeFilters.pharmacy) return false;
    if (state.activeFilters.status && p.status !== state.activeFilters.status) return false;
    if (state.activeFilters.month) {
      const t = p.date?.toDate ? p.date.toDate() : new Date(p.date);
      const key = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0');
      if (key !== state.activeFilters.month) return false;
    }
    if (state.activeFilters.dateFrom) {
      const t = p.date?.toDate ? p.date.toDate() : new Date(p.date);
      if (t < new Date(state.activeFilters.dateFrom + 'T00:00:00')) return false;
    }
    if (state.activeFilters.dateTo) {
      const t = p.date?.toDate ? p.date.toDate() : new Date(p.date);
      if (t > new Date(state.activeFilters.dateTo + 'T23:59:59')) return false;
    }
    if (state.activeFilters.amountMin && p.totalAmount < Number(state.activeFilters.amountMin)) return false;
    if (state.activeFilters.amountMax && p.totalAmount > Number(state.activeFilters.amountMax)) return false;
    if (state.activeFilters.search) {
      const q = state.activeFilters.search.toLowerCase();
      const hay = (p.pharmacy + ' ' + (p.notes||'') + ' ' + p.id).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  state.filteredPayments = applySort(state.filteredPayments);
  state.currentPage = 1;
};

export const applySort = (arr) => {
  if (!state.sortState.length) return arr;
  return [...arr].sort((a,b) => {
    for (const {key, dir} of state.sortState) {
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
};

export const toggleSort = (key, multi) => {
  const idx = state.sortState.findIndex(s => s.key === key);
  if (idx >= 0) {
    state.sortState[idx].dir = state.sortState[idx].dir === 'asc' ? 'desc' : 'asc';
    if (!multi) state.sortState = [state.sortState[idx]];
  } else {
    if (!multi) state.sortState = [];
    state.sortState.push({key, dir:'asc'});
  }
};

export const updateSortIndicators = () => {
  // This function does DOM manipulation, so we will leave it in the app or UI module for now.
  // We will export a pure function that returns the sort state for a given key?
  // For now, we leave it as a note that this function has side effects.
};

export const toggleColumn = (key, visible) => {
  if (visible) {
    delete state.columnsConfig[key];
  } else {
    state.columnsConfig[key] = false;
  }
  localStorage.setItem('crm_columnsConfig', JSON.stringify(state.columnsConfig));
};

export const toggleSidebar = () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  localStorage.setItem('crm_sidebarCollapsed', state.sidebarCollapsed);
};

export const setTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  // We assume the app will handle the icons and localStorage
};

export const saveBudget = (value) => {
  state.budgetTotal = value;
  localStorage.setItem('crm_budget', value);
};

export const saveNotifyPreference = (checked) => {
  localStorage.setItem('crm_notify', checked.toString());
};

export const saveProduct = (key, product) => {
  state.products[key] = product;
  localStorage.setItem('crm_products', JSON.stringify(state.products));
};

export const deleteProduct = (key) => {
  delete state.products[key];
  localStorage.setItem('crm_products', JSON.stringify(state.products));
};

// Note: We are not exporting the render functions because they have DOM side effects.
// We will handle rendering in the app or UI module.

// We are also not exporting the loadData function because it has Firebase listeners and DOM side effects.
// We will handle that in the app module.

// Export the state for direct access if needed (but prefer using the functions)
export default state;