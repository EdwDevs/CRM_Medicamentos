import { store } from './js/state/store.js';
import { fetchBudget, reloadBudget } from './js/services/budgetService.js';
import {
  fetchPayments,
  createPayment,
  deletePayment,
  togglePaymentStatus,
  getPayment,
  ensureStatsDocument
} from './js/services/paymentsService.js';
import {
  renderBudget,
  renderStatusBadges,
  renderPayments,
  renderPagination,
  renderFiltersOptions
} from './js/ui/renderers.js';
import { showToast } from './js/ui/toast.js';
import { openPaymentDetails, openReloadBudgetDialog } from './js/ui/dialogs.js';
import { formatCurrency, normalizeText } from './js/utils/format.js';
import { DEFAULT_PAGE_SIZE } from './js/config/app.js';

const paymentForm = document.getElementById('paymentForm');
const filtersForm = document.getElementById('filters-form');
const clearFiltersButton = document.getElementById('clearFilters');
const reloadButton = document.getElementById('reloadBudgetButton');
const pageSizeSelect = document.getElementById('pageSize');
const tableBody = document.getElementById('paymentsTableBody');
const previousPageButton = document.getElementById('previousPage');
const nextPageButton = document.getElementById('nextPage');
const totalPreview = document.getElementById('totalPreview');
const totalAmountPreview = document.getElementById('totalAmountPreview');
const budgetWarning = document.getElementById('budgetWarning');

const paginationState = {
  pageEnds: [],
  currentIndex: 0
};

function debounce(fn, delay = 300) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

async function init() {
  renderFiltersOptions();
  setDefaultFormValues();
  attachListeners();

  try {
    const [budgetAmount, statsData] = await Promise.all([
      fetchBudget(),
      ensureStatsDocument()
    ]);
    store.setBudget(budgetAmount);
    store.setTotals({
      totalSpent: statsData.totalSpent ?? 0,
      counts: {
        pendiente: statsData.pendingCount ?? 0,
        procesado: statsData.processedCount ?? 0
      }
    });
  } catch (error) {
    console.error('Error inicializando datos', error);
    showToast('No fue posible sincronizar los datos iniciales.', 'error');
  }

  await loadPayments({ reset: true });
}

function attachListeners() {
  store.subscribe(updateUI);

  paymentForm.addEventListener('input', debounce(updateTotalPreview, 150));
  paymentForm.addEventListener('reset', () => {
    paymentForm.classList.remove('was-validated');
    totalPreview.hidden = true;
    updateTotalPreview();
  });
  paymentForm.addEventListener('submit', handlePaymentSubmit);

  const filterControls = Array.from(filtersForm.elements);
  filterControls.forEach((control) => {
    const handler = control.id === 'filterPharmacy' ? debounce(handleFiltersChange) : handleFiltersChange;
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(eventName, handler);
  });

  clearFiltersButton.addEventListener('click', () => {
    filtersForm.reset();
    store.setFilters({ product: '', pharmacy: '', month: '', status: '' });
    paginationState.currentIndex = 0;
    paginationState.pageEnds = [];
    loadPayments({ reset: true });
  });

  reloadButton.addEventListener('click', () => {
    const state = store.getState();
    openReloadBudgetDialog({
      budgetTotal: state.budgetTotal,
      totalSpent: state.totalSpent,
      available: store.availableBudget
    }, async ({ amount, notes }) => {
      try {
        const result = await reloadBudget({ amount: Number(amount), notes });
        store.setBudget(result.newTotal);
        showToast(`Presupuesto actualizado a ${formatCurrency(result.newTotal)}.`, 'success');
      } catch (error) {
        console.error('Error recargando presupuesto', error);
        showToast('No fue posible registrar la recarga.', 'error');
      }
    });
  });

  pageSizeSelect.addEventListener('change', () => {
    const value = Number(pageSizeSelect.value) || DEFAULT_PAGE_SIZE;
    store.setPageSize(value);
    paginationState.pageEnds = [];
    paginationState.currentIndex = 0;
    loadPayments({ reset: true });
  });

  previousPageButton.addEventListener('click', () => {
    if (paginationState.currentIndex === 0) return;
    paginationState.currentIndex -= 1;
    loadPayments();
  });

  nextPageButton.addEventListener('click', () => {
    const { pagination } = store.getState();
    if (!pagination.hasNext) return;
    paginationState.currentIndex += 1;
    loadPayments();
  });

  tableBody.addEventListener('click', handleTableAction);
  tableBody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-action]');
    if (!target) return;
    event.preventDefault();
    handleTableAction(event);
  });
}

function setDefaultFormValues() {
  const dateField = document.getElementById('date');
  if (dateField && !dateField.value) {
    dateField.value = new Date().toISOString().slice(0, 10);
  }
  const quantityField = document.getElementById('quantity');
  if (quantityField && !quantityField.value) {
    quantityField.value = 1;
  }
}

function updateUI(state) {
  renderBudget({
    budgetTotal: state.budgetTotal,
    totalSpent: state.totalSpent,
    available: store.availableBudget
  });
  renderStatusBadges(state.counts);
  renderPayments(state.payments);
  renderPagination({
    total: state.pagination.total,
    pageSize: state.pagination.pageSize ?? state.pageSize,
    currentIndex: state.pagination.currentIndex,
    hasNext: state.pagination.hasNext,
    hasPrevious: state.pagination.hasPrevious,
    displayed: state.pagination.displayed
  });
  updateBudgetWarning();
}

async function loadPayments({ reset = false } = {}) {
  const { filters, pageSize } = store.getState();

  if (reset) {
    paginationState.pageEnds = [];
    paginationState.currentIndex = 0;
    setTableLoading();
  } else {
    setTableLoading();
  }

  try {
    const cursor = paginationState.currentIndex === 0
      ? undefined
      : paginationState.pageEnds[paginationState.currentIndex - 1];

    const queryFilters = {
      ...filters,
      pharmacy: filters.pharmacy ? normalizeText(filters.pharmacy) : ''
    };

    const result = await fetchPayments({
      pageSize,
      cursor,
      filters: queryFilters
    });

    store.setTotals(result.totals);
    store.setPayments(result.payments, {
      total: result.pagination.total,
      hasNext: result.pagination.hasNext,
      hasPrevious: paginationState.currentIndex > 0,
      pageIndex: paginationState.currentIndex,
      displayed: result.payments.length,
      pageSize
    });

    paginationState.pageEnds[paginationState.currentIndex] = result.pagination.lastVisible ?? null;
  } catch (error) {
    console.error('Error cargando pagos', error);
    showToast('No fue posible cargar los pagos.', 'error');
    store.setPayments([], {
      total: 0,
      hasNext: false,
      hasPrevious: false,
      pageIndex: 0,
      displayed: 0,
      pageSize: store.getState().pageSize
    });
  }
}

function setTableLoading() {
  tableBody.innerHTML = `
    <tr>
      <td colspan="9" class="text-center text-muted py-4">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Actualizando información...
      </td>
    </tr>
  `;
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  paymentForm.classList.add('was-validated');
  if (!paymentForm.checkValidity()) {
    return;
  }

  const formData = new FormData(paymentForm);
  const payload = {
    pharmacy: formData.get('pharmacy'),
    product: formData.get('product'),
    quantity: formData.get('quantity'),
    unitPrice: formData.get('unitPrice'),
    date: formData.get('date'),
    status: formData.get('status'),
    notes: formData.get('notes')
  };

  try {
    await createPayment(payload);
    showToast('Pago registrado correctamente.', 'success');
    paymentForm.reset();
    setDefaultFormValues();
    totalPreview.hidden = true;
    await loadPayments({ reset: true });
  } catch (error) {
    console.error('Error registrando pago', error);
    if (error.message === 'INSUFFICIENT_BUDGET') {
      showToast('El monto supera el presupuesto disponible.', 'error');
    } else {
      showToast('No fue posible registrar el pago.', 'error');
    }
  }
}

function handleFiltersChange() {
  const filters = {
    product: filtersForm.elements.filterProduct.value,
    pharmacy: filtersForm.elements.filterPharmacy.value.trim(),
    month: filtersForm.elements.filterMonth.value,
    status: filtersForm.elements.filterStatus.value
  };
  store.setFilters(filters);
  paginationState.pageEnds = [];
  paginationState.currentIndex = 0;
  loadPayments({ reset: true });
}

async function handleTableAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const row = target.closest('tr');
  const paymentId = row?.dataset.id;
  if (!paymentId) return;

  const action = target.dataset.action;

  if (action === 'delete') {
    if (!confirm('¿Deseas eliminar este pago?')) return;
    try {
      await deletePayment(paymentId);
      showToast('Pago eliminado correctamente.', 'success');
      await loadPayments({ reset: true });
    } catch (error) {
      console.error('Error eliminando pago', error);
      showToast('No fue posible eliminar el pago.', 'error');
    }
    return;
  }

  if (action === 'view') {
    try {
      const payment = await getPayment(paymentId);
      openPaymentDetails(payment);
    } catch (error) {
      console.error('Error consultando pago', error);
      showToast('No fue posible cargar el detalle.', 'error');
    }
    return;
  }

  if (action === 'toggle-status') {
    try {
      const newStatus = await togglePaymentStatus(paymentId);
      showToast(`Estado actualizado a ${newStatus}.`, 'success');
      await loadPayments();
    } catch (error) {
      console.error('Error cambiando estado', error);
      showToast('No fue posible actualizar el estado.', 'error');
    }
  }
}

function updateTotalPreview() {
  const quantity = Number(paymentForm.elements.quantity.value);
  const unitPrice = Number(paymentForm.elements.unitPrice.value);

  if (!quantity || !unitPrice) {
    totalPreview.hidden = true;
    return;
  }

  const total = quantity * unitPrice;
  totalAmountPreview.textContent = formatCurrency(total);
  totalPreview.hidden = false;

  const available = store.availableBudget;
  if (total > available) {
    totalPreview.classList.remove('alert-info');
    totalPreview.classList.add('alert-warning');
    budgetWarning.textContent = `Advertencia: supera el disponible (${formatCurrency(available)}).`;
  } else {
    totalPreview.classList.remove('alert-warning');
    totalPreview.classList.add('alert-info');
    budgetWarning.textContent = `Disponible: ${formatCurrency(available)}.`;
  }
}

function updateBudgetWarning() {
  const available = store.availableBudget;
  const total = Number(paymentForm.elements.quantity.value || 0) * Number(paymentForm.elements.unitPrice.value || 0);
  if (total > 0) {
    const message = total > available
      ? `Advertencia: supera el disponible (${formatCurrency(available)}).`
      : `Disponible: ${formatCurrency(available)}.`;
    budgetWarning.textContent = message;
  }
}

document.addEventListener('DOMContentLoaded', init);
