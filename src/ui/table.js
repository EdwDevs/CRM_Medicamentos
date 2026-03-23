export const renderTable = (data, { utils, getProductConfig }) => {
  const tbody = document.getElementById("payments-table-body");
  const emptyState = document.getElementById("empty-state");
  tbody.innerHTML = "";

  if (data.length === 0) {
    emptyState.classList.remove("d-none");
    return;
  }

  emptyState.classList.add("d-none");

  data.forEach((item, index) => {
    const prodConfig = getProductConfig(item.product);
    const isProcessed = item.status === "procesado";
    const delay = Math.min(index * 50, 500);

    const row = document.createElement("tr");
    row.className = "animate-row";
    row.style.animationDelay = `${delay}ms`;

    row.innerHTML = `
      <td class="fw-medium text-muted col-priority-essential" data-label="Fecha">${utils.fmtDate(item.date)}</td>
      <td class="fw-bold text-dark col-priority-essential" data-label="Farmacia">${item.pharmacy}</td>
      <td class="text-end fw-bold text-primary font-monospace col-priority-essential" data-label="Total">${utils.fmtMoney(item.totalAmount)}</td>
      <td class="text-center col-priority-essential" data-label="Estado">
          <!-- IMPORTANTE: estado también es acción; se mantiene área táctil >=48px para accesibilidad móvil. -->
          <button onclick="app.toggleStatus('${item.id}', '${item.status}')"
              class="btn btn-sm border-0 badge-status-${item.status} table-status-btn fw-bold text-uppercase px-3 rounded-pill" style="font-size: 0.7rem; letter-spacing: 0.5px;">
              ${isProcessed ? '<i class="fa-solid fa-check me-1"></i>Procesado' : '<i class="fa-regular fa-clock me-1"></i>Pendiente'}
          </button>
      </td>
      <td class="text-end pe-md-4 col-priority-essential" data-label="Acciones">
          <div class="d-flex justify-content-end gap-2 align-items-center">
              <!-- IMPORTANTE: feedback instantáneo en :active/:focus-visible evita depender de hover en pantallas táctiles. -->
              <button onclick="app.openDetails('${item.id}')" class="btn btn-sm btn-light text-primary table-action-btn" aria-label="Ver detalle de la fila">
                  <i class="fa-regular fa-eye"></i>
              </button>
              <!-- Importante: datos/acciones secundarios se mueven al patrón de expansión por fila. -->
              <details class="row-expand-details">
                  <summary class="btn btn-sm btn-light text-secondary table-action-btn" aria-label="Ver más opciones y datos de la fila">
                      <i class="fa-solid fa-ellipsis"></i>
                  </summary>
                  <div class="row-expand-panel text-start">
                      <div class="row-expand-line col-priority-secondary" data-label="Producto">
                          <span class="badge-product ${prodConfig.badge}">
                              <i class="fa-solid ${prodConfig.icon}"></i> ${prodConfig.label}
                          </span>
                      </div>
                      <div class="row-expand-line col-priority-secondary" data-label="Cantidad">
                          <span class="fw-medium">${item.quantity}</span>
                      </div>
                      <div class="row-expand-line col-priority-secondary" data-label="Unitario">
                          <span class="text-muted font-monospace">${utils.fmtMoney(item.unitPrice)}</span>
                      </div>
                      <div class="pt-2 border-top mt-2 col-priority-secondary">
                          <button onclick="app.deleteItem('${item.id}')" class="btn btn-sm btn-light text-danger table-action-btn w-100">
                              <i class="fa-regular fa-trash-can me-1"></i> Eliminar
                          </button>
                      </div>
                  </div>
              </details>
          </div>
      </td>
    `;

    tbody.appendChild(row);
  });
};

export const updateFiltersUI = (payments) => {
  const pharmacySelect = document.getElementById("filter-pharmacy");
  const currentVal = pharmacySelect.value;
  const pharmacies = [...new Set(payments.map((p) => p.pharmacy))].sort();

  pharmacySelect.innerHTML = '<option value="">Todas las farmacias</option>';
  pharmacies.forEach((ph) => {
    const opt = document.createElement("option");
    opt.value = ph;
    opt.textContent = ph;
    pharmacySelect.appendChild(opt);
  });
  pharmacySelect.value = currentVal;

  const dataList = document.getElementById("pharmacy-list");
  dataList.innerHTML = "";
  pharmacies.forEach((ph) => {
    const opt = document.createElement("option");
    opt.value = ph;
    dataList.appendChild(opt);
  });
};
