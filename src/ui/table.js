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
      <td class="fw-medium text-muted" data-label="Fecha">${utils.fmtDate(item.date)}</td>
      <td class="fw-bold text-dark" data-label="Farmacia">${item.pharmacy}</td>
      <td data-label="Producto">
          <span class="badge-product ${prodConfig.badge}">
              <i class="fa-solid ${prodConfig.icon}"></i> ${prodConfig.label}
          </span>
      </td>
      <td class="text-center fw-medium" data-label="Cant.">${item.quantity}</td>
      <td class="text-end text-muted font-monospace" data-label="Unitario">${utils.fmtMoney(item.unitPrice)}</td>
      <td class="text-end fw-bold text-primary font-monospace" data-label="Total">${utils.fmtMoney(item.totalAmount)}</td>
      <td class="text-center" data-label="Estado">
          <button onclick="app.toggleStatus('${item.id}', '${item.status}')"
              class="btn btn-sm border-0 badge-status-${item.status} fw-bold text-uppercase px-3 py-1 rounded-pill" style="font-size: 0.7rem; letter-spacing: 0.5px;">
              ${isProcessed ? '<i class="fa-solid fa-check me-1"></i>Procesado' : '<i class="fa-regular fa-clock me-1"></i>Pendiente'}
          </button>
      </td>
      <td class="text-end pe-md-4" data-label="Acciones">
          <div class="d-flex justify-content-end gap-2">
              <button onclick="app.openDetails('${item.id}')" class="btn btn-sm btn-light text-primary hover-shadow">
                  <i class="fa-regular fa-eye"></i>
              </button>
              <button onclick="app.deleteItem('${item.id}')" class="btn btn-sm btn-light text-danger hover-shadow">
                  <i class="fa-regular fa-trash-can"></i>
              </button>
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
