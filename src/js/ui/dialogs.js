import { formatCurrency, formatDate } from '../utils/format.js';
import { PRODUCT_CATALOG } from '../config/products.js';

function ensureBootstrap() {
  const { bootstrap } = window;
  if (!bootstrap) {
    throw new Error('Bootstrap no está disponible. Asegúrate de cargar "bootstrap.bundle.min.js".');
  }
  return bootstrap;
}

function createModal(markup) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = markup.trim();
  const element = wrapper.firstElementChild;
  document.body.appendChild(element);
  const bootstrap = ensureBootstrap();
  const modal = new bootstrap.Modal(element);
  element.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    element.remove();
  });
  return { modal, element };
}

export function openPaymentDetails(payment) {
  const meta = PRODUCT_CATALOG[payment.product] ?? { name: payment.product, icon: '📦' };
  const { modal, element } = createModal(`
    <div class="modal fade" tabindex="-1" aria-labelledby="paymentDetailsTitle" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="paymentDetailsTitle">Detalle del pago</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <article class="vstack gap-3">
              <header>
                <p class="text-muted mb-1">${formatDate(payment.date)}</p>
                <h3 class="h5 mb-0">${meta.icon ?? '📦'} ${meta.name}</h3>
              </header>
              <dl class="row mb-0">
                <dt class="col-5">Farmacia</dt>
                <dd class="col-7">${payment.pharmacy}</dd>
                <dt class="col-5">Cantidad</dt>
                <dd class="col-7">${payment.quantity}</dd>
                <dt class="col-5">Valor unitario</dt>
                <dd class="col-7">${formatCurrency(payment.unitPrice)}</dd>
                <dt class="col-5">Total</dt>
                <dd class="col-7 fw-semibold">${formatCurrency(payment.totalAmount)}</dd>
                <dt class="col-5">Estado</dt>
                <dd class="col-7 text-capitalize">${payment.status}</dd>
              </dl>
              <section>
                <h4 class="h6">Notas</h4>
                <p class="mb-0">${payment.notes || 'Sin notas adicionales'}</p>
              </section>
            </article>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `);

  modal.show();
  return element;
}

export function openReloadBudgetDialog({ budgetTotal, totalSpent, available }, onConfirm) {
  const { modal, element } = createModal(`
    <div class="modal fade" tabindex="-1" aria-labelledby="reloadBudgetTitle" aria-modal="true" role="dialog">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="reloadBudgetTitle">Registrar recarga de presupuesto</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <form id="reloadBudgetForm" class="modal-body vstack gap-3">
            <section class="alert alert-info" role="status">
              <p class="fw-semibold mb-1">Estado actual</p>
              <dl class="row mb-0">
                <dt class="col-6">Total asignado</dt>
                <dd class="col-6">${formatCurrency(budgetTotal)}</dd>
                <dt class="col-6">Gastado</dt>
                <dd class="col-6">${formatCurrency(totalSpent)}</dd>
                <dt class="col-6">Disponible</dt>
                <dd class="col-6">${formatCurrency(available)}</dd>
              </dl>
            </section>
            <div>
              <label for="reloadAmount" class="form-label">Monto a recargar</label>
              <input type="number" id="reloadAmount" name="amount" class="form-control" min="1000" step="500" required aria-describedby="reloadAmountHelp">
              <div id="reloadAmountHelp" class="form-text">Ingresa el valor en pesos colombianos.</div>
              <div class="invalid-feedback">Introduce un monto válido mayor a cero.</div>
            </div>
            <div>
              <label for="reloadNotes" class="form-label">Notas (opcional)</label>
              <textarea id="reloadNotes" name="notes" class="form-control" rows="2" placeholder="Motivo de la recarga"></textarea>
            </div>
            <div class="alert alert-success d-none" id="reloadPreview" role="status"></div>
            <div class="modal-footer px-0">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-success">Registrar recarga</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  const form = element.querySelector('#reloadBudgetForm');
  const amountInput = element.querySelector('#reloadAmount');
  const preview = element.querySelector('#reloadPreview');

  amountInput.addEventListener('input', () => {
    const amount = Number(amountInput.value);
    if (amount > 0) {
      amountInput.classList.remove('is-invalid');
      preview.classList.remove('d-none');
      const newTotal = budgetTotal + amount;
      const newAvailable = available + amount;
      preview.innerHTML = `Nuevo total: <strong>${formatCurrency(newTotal)}</strong><br>Disponible: <strong>${formatCurrency(newAvailable)}</strong>`;
    } else {
      preview.classList.add('d-none');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number(amountInput.value);
    if (!amount || amount <= 0) {
      amountInput.classList.add('is-invalid');
      return;
    }
    amountInput.classList.remove('is-invalid');
    const notes = form.elements.namedItem('notes').value.trim();
    Promise.resolve(onConfirm({ amount, notes })).finally(() => {
      modal.hide();
    });
  });

  modal.show();
  return element;
}
