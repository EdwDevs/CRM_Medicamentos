import {
  createPaymentReference,
  savePayment,
  saveReintegro,
  buildReintegroMovement,
  togglePaymentStatus,
  deletePayment
} from "../services/payments.js";
import { getProductConfig, getAvailablePaymentReferencesByPharmacy } from "../services/references.js";

const normalizeWhitespace = (value) => (value || "").trim().replace(/\s+/g, " ");

const clearFieldErrors = (fieldIds = []) => {
  fieldIds.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove("is-invalid");

    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) errorEl.remove();
  });
};

const setFieldError = (fieldId, message) => {
  const field = document.getElementById(fieldId);
  if (!field) return;

  field.classList.add("is-invalid");

  let errorEl = document.getElementById(`${fieldId}-error`);
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.id = `${fieldId}-error`;
    errorEl.className = "invalid-feedback d-block";
    field.insertAdjacentElement("afterend", errorEl);
  }

  errorEl.textContent = message;
};

export const renderPaymentReferencesSelector = (pharmacy, state, utils) => {
  const selector = document.getElementById("pay-refs");
  const selectedValues = Array.from(selector.selectedOptions || []).map((option) => option.value);
  const availableReferences = getAvailablePaymentReferencesByPharmacy(state.paymentReferences, pharmacy, utils.normalizeText);

  selector.innerHTML = "";
  availableReferences.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.reference;
    option.textContent = item.reference;
    option.selected = selectedValues.includes(item.reference);
    selector.appendChild(option);
  });
};

export const handleCreatePaymentReference = async ({ db, state, utils }) => {
  const pharmacyValue = document.getElementById("pay-pharmacy").value;
  const normalizedPharmacy = utils.normalizeText(pharmacyValue);

  if (!normalizedPharmacy) {
    utils.showToast("Primero ingresa la farmacia para asociar la referencia.", "warning");
    return;
  }

  const newReferenceValue = prompt("Nueva referencia de pago");
  if (newReferenceValue === null) return;

  const visibleReference = newReferenceValue.trim();
  const normalizedReference = utils.normalizeText(newReferenceValue);

  if (!normalizedReference) {
    utils.showToast("La referencia no puede estar vacía.", "warning");
    return;
  }

  const duplicatedInCache = state.paymentReferences.some(
    (item) => utils.normalizeText(item.pharmacy) === normalizedPharmacy && utils.normalizeText(item.reference) === normalizedReference
  );

  if (duplicatedInCache) {
    utils.showToast("Esa referencia ya existe para esta farmacia.", "warning");
    return;
  }

  try {
    utils.toggleLoader(true);
    const created = await createPaymentReference(db, normalizedPharmacy, visibleReference, utils.normalizeText);
    if (!created) {
      utils.showToast("Esa referencia ya existe para esta farmacia.", "warning");
      return;
    }

    renderPaymentReferencesSelector(pharmacyValue, state, utils);
    utils.showToast("Referencia creada exitosamente.");
  } catch (error) {
    utils.showToast(`No fue posible crear la referencia: ${error.message}`, "error");
  } finally {
    utils.toggleLoader(false);
  }
};

export const handleSavePayment = async ({ db, state, utils }) => {
  clearFieldErrors(["pay-pharmacy", "pay-product", "pay-date", "pay-qty", "pay-price", "pay-status", "pay-refs"]);

  const pharmacy = document.getElementById("pay-pharmacy").value;
  const product = document.getElementById("pay-product").value;
  const dateVal = document.getElementById("pay-date").value;
  const qty = parseInt(document.getElementById("pay-qty").value);
  const price = parseFloat(document.getElementById("pay-price").value);
  const status = document.getElementById("pay-status").value;
  const notes = document.getElementById("pay-notes").value;
  const refs = Array.from(document.getElementById("pay-refs").selectedOptions).map((option) => option.value);

  const normalizedPharmacy = normalizeWhitespace(pharmacy);
  const normalizedRefs = [...new Set(refs.map((ref) => ref.trim()).filter((ref) => ref))];

  let hasValidationError = false;

  if (!normalizedPharmacy) {
    setFieldError("pay-pharmacy", "La farmacia es obligatoria.");
    hasValidationError = true;
  }

  if (!product) {
    setFieldError("pay-product", "Selecciona un producto.");
    hasValidationError = true;
  }

  if (!dateVal) {
    setFieldError("pay-date", "La fecha es obligatoria.");
    hasValidationError = true;
  }

  if (!Number.isInteger(qty) || qty <= 0) {
    setFieldError("pay-qty", "La cantidad debe ser mayor a 0.");
    hasValidationError = true;
  }

  if (Number.isNaN(price) || price < 0) {
    setFieldError("pay-price", "El valor unitario debe ser 0 o mayor.");
    hasValidationError = true;
  }

  if (status === "procesado" && normalizedRefs.length === 0) {
    setFieldError("pay-refs", "Para estado procesado debes seleccionar al menos una referencia.");
    hasValidationError = true;
  }

  if (hasValidationError) {
    return;
  }

  document.getElementById("pay-pharmacy").value = normalizedPharmacy;

  const newPayment = {
    cliente: normalizedPharmacy,
    producto: product === "multidol400" ? "MULTIDOL X400" : product === "multidol800" ? "MULTIDOL X800" : "DESCONGEL",
    cajasPagadas: qty,
    valorUnitario: price,
    totalPago: qty * price,
    fecha: dateVal,
    status,
    observaciones: notes,
    fechaRegistro: new Date().toISOString(),
    paymentReferences: normalizedRefs
  };

  try {
    utils.toggleLoader(true);
    await savePayment(db, newPayment);

    const modalEl = document.getElementById("modalNewPayment");
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    document.getElementById("form-payment").reset();
    document.getElementById("pay-date").valueAsDate = new Date();
    document.getElementById("pay-preview-alert").classList.add("d-none");
    renderPaymentReferencesSelector("", state, utils);

    utils.showToast("Pago registrado exitosamente");
  } catch (error) {
    console.error(error);
    utils.showToast(`Error al guardar: ${error.message}`, "error");
  } finally {
    utils.toggleLoader(false);
  }
};

export const handleSaveReintegro = async ({ db, utils }) => {
  clearFieldErrors(["reint-amount", "reint-date", "reint-ids"]);

  const amount = parseFloat(document.getElementById("reint-amount").value);
  const dateVal = document.getElementById("reint-date").value;
  const idsTxt = document.getElementById("reint-ids").value;
  const notes = document.getElementById("reint-notes").value;

  let hasValidationError = false;

  if (!amount || amount <= 0) {
    setFieldError("reint-amount", "Ingresa un monto válido mayor a 0.");
    hasValidationError = true;
  }

  if (!dateVal) {
    setFieldError("reint-date", "La fecha es obligatoria.");
    hasValidationError = true;
  }

  const rawIds = idsTxt.split(",").map((s) => s.trim());
  const hasEmptyIds = idsTxt.trim().length > 0 && rawIds.some((id) => !id);

  if (hasEmptyIds) {
    setFieldError("reint-ids", "No se permiten IDs vacíos. Revisa comas duplicadas o al final.");
    hasValidationError = true;
  }

  const refIds = rawIds.filter((id) => id);
  if (new Set(refIds).size !== refIds.length) {
    setFieldError("reint-ids", "No se permiten IDs duplicados en las referencias del reintegro.");
    hasValidationError = true;
  }

  if (hasValidationError) {
    return;
  }

  try {
    utils.toggleLoader(true);
    await saveReintegro(db, buildReintegroMovement({ amount, dateVal, refIds, notes }));

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalReintegro"));
    modal.hide();
    document.getElementById("form-reintegro").reset();
    document.getElementById("reint-date").valueAsDate = new Date();

    utils.showToast("Reintegro registrado. Disponible actualizado.");
  } catch (error) {
    utils.showToast(`Error: ${error.message}`, "error");
  } finally {
    utils.toggleLoader(false);
  }
};

export const toggleStatus = async ({ db, id, currentStatus, utils }) => {
  const newStatus = currentStatus === "pendiente" ? "procesado" : "pendiente";
  try {
    await togglePaymentStatus(db, id, newStatus);
    utils.showToast(`Estado actualizado a ${newStatus}`);
  } catch (error) {
    utils.showToast("Error actualizando estado", "error");
  }
};

export const deleteItem = async ({ db, id, utils }) => {
  if (!confirm("¿Estás seguro de eliminar este registro permanentemente?")) return;

  try {
    await deletePayment(db, id);
    utils.showToast("Registro eliminado");
  } catch (error) {
    utils.showToast("Error eliminando", "error");
  }
};

export const openDetails = ({ id, state, utils }) => {
  const item = state.payments.find((p) => p.id === id);
  if (!item) return;

  const prodConfig = getProductConfig(item.product);
  const content = document.getElementById("detail-content");

  content.innerHTML = `
    <div class="p-4 bg-light d-flex align-items-center justify-content-between">
        <div>
            <span class="badge ${prodConfig.badge} mb-2 fs-6">
                <i class="fa-solid ${prodConfig.icon} me-1"></i> ${prodConfig.label}
            </span>
            <h4 class="mb-0 fw-bold">${item.pharmacy}</h4>
        </div>
        <div class="text-end">
            <h3 class="fw-bold text-primary mb-0">${utils.fmtMoney(item.totalAmount)}</h3>
            <small class="text-muted">${item.quantity} und. a ${utils.fmtMoney(item.unitPrice)}</small>
        </div>
    </div>
    <div class="p-4">
      <div class="row g-4">
        <div class="col-6">
          <label class="small text-muted fw-bold text-uppercase">Fecha</label>
          <p class="mb-0 fw-medium">${utils.fmtDate(item.date)}</p>
        </div>
        <div class="col-6">
          <label class="small text-muted fw-bold text-uppercase">Estado</label>
          <div>
            <span class="badge rounded-pill bg-${item.status === "procesado" ? "success" : "warning"} text-dark bg-opacity-25">
              ${item.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div class="col-12">
          <label class="small text-muted fw-bold text-uppercase">Referencias de Pago</label>
          <div class="bg-white border rounded p-2 mt-1">
            ${
              item.paymentReferences && item.paymentReferences.length > 0
                ? item.paymentReferences.map((r) => `<span class="badge bg-secondary me-1">${r}</span>`).join("")
                : '<span class="text-muted fst-italic small">Sin referencias</span>'
            }
          </div>
        </div>
        <div class="col-12">
          <label class="small text-muted fw-bold text-uppercase">Notas</label>
          <p class="mb-0 text-secondary">${item.notes || item.observaciones || "Sin notas adicionales."}</p>
        </div>
      </div>
    </div>
    <div class="p-3 bg-light border-top text-end">
      <button class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById("modalDetails"));
  modal.show();
};
