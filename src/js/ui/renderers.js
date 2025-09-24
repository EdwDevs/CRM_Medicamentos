import { PRODUCT_CATALOG } from '../config/products.js';
import { STATUS_OPTIONS } from '../config/app.js';
import { formatCurrency, formatDate } from '../utils/format.js';

const budgetTotalEl = document.getElementById('budget-total');
const budgetSpentEl = document.getElementById('budget-spent');
const budgetAvailableEl = document.getElementById('budget-available');
const budgetProgressBar = document.getElementById('budget-progress');
const statusBadgesEl = document.getElementById('status-badges');
const tableBody = document.getElementById('paymentsTableBody');
const paginationStatus = document.getElementById('paginationStatus');
const previousButton = document.getElementById('previousPage');
const nextButton = document.getElementById('nextPage');
const template = document.getElementById('paymentRowTemplate');
const statusPillTemplate = document.getElementById('statusPillTemplate');

/**
 * @param {{ budgetTotal: number, totalSpent: number, available: number }} budget
 */
export function renderBudget({ budgetTotal, totalSpent, available }) {
  const spentPercentage = budgetTotal > 0 ? Math.min((totalSpent / budgetTotal) * 100, 100) : 0;

  budgetTotalEl.textContent = formatCurrency(budgetTotal);
  budgetSpentEl.textContent = formatCurrency(totalSpent);
  budgetAvailableEl.textContent = formatCurrency(available);
  budgetProgressBar.style.width = `${spentPercentage}%`;
  budgetProgressBar.setAttribute('aria-valuenow', spentPercentage.toFixed(0));
  budgetProgressBar.setAttribute('aria-valuemin', '0');
  budgetProgressBar.setAttribute('aria-valuemax', '100');
}

/**
 * @param {{ pendiente: number, procesado: number }} counts
 */
export function renderStatusBadges(counts) {
  statusBadgesEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  STATUS_OPTIONS.forEach((option) => {
    const li = document.createElement('li');
    li.classList.add('badge-pill');
    const value = counts[option.value] ?? 0;
    li.textContent = `${option.label}s: ${value}`;
    if (option.value === 'pendiente') {
      li.classList.add('bg-warning-subtle', 'text-warning-emphasis');
    } else {
      li.classList.add('bg-success-subtle', 'text-success-emphasis');
    }
    fragment.appendChild(li);
  });
  statusBadgesEl.appendChild(fragment);
}

/**
 * @param {import('../services/paymentsService.js').PaymentRecord[]} payments
 */
export function renderPayments(payments) {
  tableBody.innerHTML = '';
  if (!payments.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="9" class="py-4 text-center text-muted">No se encontraron registros para los filtros seleccionados.</td>';
    tableBody.appendChild(emptyRow);
    return;
  }

  const fragment = document.createDocumentFragment();
  payments.forEach((payment) => {
    const meta = PRODUCT_CATALOG[payment.product] ?? { name: payment.product, icon: '📦' };
    const row = template.content.cloneNode(true);
    const rowEl = row.querySelector('tr');
    rowEl.dataset.id = payment.id;
    row.querySelector('[data-cell="date"]').textContent = formatDate(payment.date);
    row.querySelector('[data-cell="pharmacy"]').textContent = payment.pharmacy;
    row.querySelector('[data-cell="product"]').innerHTML = `${meta.icon ?? '📦'} ${meta.name}`;
    row.querySelector('[data-cell="quantity"]').textContent = payment.quantity.toString();
    row.querySelector('[data-cell="unitPrice"]').textContent = formatCurrency(payment.unitPrice);
    row.querySelector('[data-cell="totalAmount"]').textContent = formatCurrency(payment.totalAmount);

    const statusCell = row.querySelector('[data-cell="status"]');
    const pill = statusPillTemplate.content.firstElementChild.cloneNode(true);
    pill.dataset.status = payment.status;
    pill.textContent = `${getStatusIcon(payment.status)} ${getStatusLabel(payment.status)}`;
    pill.classList.add('badge-status');
    pill.setAttribute('data-action', 'toggle-status');
    pill.setAttribute('role', 'button');
    pill.tabIndex = 0;
    statusCell.appendChild(pill);

    row.querySelector('[data-cell="notes"]').textContent = payment.notes || '—';

    const actionsCell = row.querySelector('[data-cell="actions"]');
    actionsCell.classList.add('payment-actions');
    actionsCell.innerHTML = `
      <div class="btn-group" role="group">
        <button type="button" class="btn btn-outline-secondary btn-sm" data-action="view" title="Ver detalles">
          <i class="fa-solid fa-eye" aria-hidden="true"></i>
          <span class="visually-hidden">Ver detalles</span>
        </button>
        <button type="button" class="btn btn-outline-danger btn-sm" data-action="delete" title="Eliminar">
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          <span class="visually-hidden">Eliminar</span>
        </button>
      </div>
    `;

    fragment.appendChild(row);
  });

  tableBody.appendChild(fragment);
}

export function renderPagination({ total, pageSize, currentIndex, hasNext, hasPrevious, displayed }) {
  if (!total) {
    paginationStatus.textContent = 'Sin resultados';
  } else {
    const start = currentIndex * pageSize + (displayed > 0 ? 1 : 0);
    const end = start + displayed - 1;
    paginationStatus.textContent = `Mostrando ${start}-${end} de ${total}`;
  }
  previousButton.disabled = !hasPrevious;
  nextButton.disabled = !hasNext;
}

export function renderFiltersOptions() {
  const productSelects = [document.getElementById('product'), document.getElementById('filterProduct')];
  productSelects.forEach((select, index) => {
    select.innerHTML = index === 1 ? '<option value="">Todos</option>' : '';
    Object.entries(PRODUCT_CATALOG).forEach(([value, meta]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = meta.name;
      select.appendChild(option);
    });
  });

  const statusSelects = [document.getElementById('status'), document.getElementById('filterStatus')];
  statusSelects.forEach((select, index) => {
    select.innerHTML = index === 1 ? '<option value="">Todos</option>' : '';
    STATUS_OPTIONS.forEach((status) => {
      const option = document.createElement('option');
      option.value = status.value;
      option.textContent = `${status.icon} ${status.label}`;
      select.appendChild(option);
    });
  });
}

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getStatusIcon(value) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.icon ?? 'ℹ️';
}
