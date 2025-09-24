import { DEFAULT_BUDGET, DEFAULT_PAGE_SIZE } from '../config/app.js';

/**
 * @typedef {import('../services/paymentsService.js').PaymentRecord} PaymentRecord
 */

class AppStore extends EventTarget {
  #state = {
    budgetTotal: DEFAULT_BUDGET,
    totalSpent: 0,
    payments: /** @type {PaymentRecord[]} */ ([]),
    pageSize: DEFAULT_PAGE_SIZE,
    pagination: {
      total: 0,
      currentIndex: 0,
      hasNext: false,
      hasPrevious: false,
      displayed: 0,
      pageSize: DEFAULT_PAGE_SIZE
    },
    filters: {
      product: '',
      pharmacy: '',
      month: '',
      status: ''
    },
    counts: {
      pendiente: 0,
      procesado: 0
    }
  };

  subscribe(callback) {
    const handler = (event) => callback(event.detail);
    this.addEventListener('change', handler);
    return () => this.removeEventListener('change', handler);
  }

  getState() {
    if (typeof structuredClone === 'function') {
      return structuredClone(this.#state);
    }
    return JSON.parse(JSON.stringify(this.#state));
  }

  setBudget(budgetTotal) {
    this.#state.budgetTotal = budgetTotal;
    this.#emit();
  }

  setTotals({ totalSpent, counts }) {
    if (typeof totalSpent === 'number') {
      this.#state.totalSpent = totalSpent;
    }
    if (counts) {
      this.#state.counts = { ...this.#state.counts, ...counts };
    }
    this.#emit();
  }

  setPayments(payments, pagination) {
    this.#state.payments = payments;
    this.#state.pagination = {
      total: pagination.total ?? this.#state.pagination.total,
      currentIndex: pagination.pageIndex ?? this.#state.pagination.currentIndex,
      hasNext: Boolean(pagination.hasNext),
      hasPrevious: Boolean(pagination.hasPrevious),
      displayed: pagination.displayed ?? payments.length,
      pageSize: pagination.pageSize ?? this.#state.pageSize
    };
    this.#emit();
  }

  setPageSize(size) {
    this.#state.pageSize = size;
    this.#state.pagination.pageSize = size;
    this.#emit();
  }

  setFilters(filters) {
    this.#state.filters = { ...this.#state.filters, ...filters };
    this.#emit();
  }

  get availableBudget() {
    return Math.max(this.#state.budgetTotal - this.#state.totalSpent, 0);
  }

  #emit() {
    this.dispatchEvent(new CustomEvent('change', { detail: this.getState() }));
  }
}

export const store = new AppStore();
