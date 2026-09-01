// ====== IMPORTS ======
import { firebaseApp, auth, db } from './src/firebase/init.js';
import { state } from './src/state.js';
import { loadPayments, getCashMovements, subscribePaymentReferences } from './src/services/payments.js';

// ====== STATE SYNC ======
// Actualizar state cuando cambie la autenticación
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log('Usuario autenticado:', user.uid);
    
    // Escuchar cambios en pagos y movimientos de caja
    state.unsubPayments = loadPayments(
      db,
      (payments) => {
        state.allPayments = payments;
        state.applyModuleFilters(); // reaplicar filtros y orden
        renderPayments(); // actualizar UI
        updateStats(); // actualizar métricas
      },
      (error) => {
        console.error('Error al cargar pagos:', error);
        showError('No se pudieron cargar los pagos');
      }
    );

    state.unsubCash = getCashMovements(
      db,
      (movements) => {
        state.allCashMovements = movements;
        state.buildReintegroIndex(); // actualizar índice de reintegros
        renderCashFlow(); // actualizar UI de flujo de caja
        updateStats();
      },
      (error) => {
        console.error('Error al cargar movimientos:', error);
        showError('No se pudieron cargar los movimientos de caja');
      }
    );

    // Opcional: suscribirse a referencias de pagos para validar duplicados
    state.unsubRefs = subscribePaymentReferences(
      db,
      (refs) => {
        // actualizar lógica de validación si es necesario
      }
    );
  } else {
    console.log('Usuario no autenticado');
    // Limpiar suscripciones si el usuario sale
    if (state.unsubPayments) state.unsubPayments();
    if (state.unsubCash) state.unsubCash();
    if (state.unsubRefs) state.unsubRefs();
    state.allPayments = [];
    state.allCashMovements = [];
    renderPayments();
    renderCashFlow();
    updateStats();
  }
});

// ====== INICIALIZAR AUTH ANÓNIMO ======
// Intentar iniciar sesión de forma anónima al cargar la página
(async () => {
  try {
    const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const cred = await signInAnonymously(auth);
    console.log('Autenticación anónima exitosa:', cred.user.uid);
  } catch (error) {
    console.error('Error en auth anónimo:', error);
    // Si falla, sigue funcionando pero sin datos de Firestore
    // (las reglas permiten solo usuarios autenticados)
  }
})();

// ====== PLACEHOLDERS PARA FUNCIÓN DE UI ======
// Estas funciones deben existir en su código real o se crearán más tarde
// Por ahora, las definimos como vacías para evitar errores

function renderPayments() {
  // TODO: Renderizar la tabla de pagos con state.filteredPayments
  console.log('Renderizando pagos:', state.filteredPayments.length);
  const tbody = document.querySelector('#payments-table tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="px-4 py-2 text-center">Cargando pagos...</td></tr>
    `;
    // En su código real, aquí iria la lógica para crear las filas de la tabla
  }
}

function renderCashFlow() {
  // TODO: Renderizar el flujo de caja con state.allCashMovements
  console.log('Renderizando flujo de caja:', state.allCashMovements.length);
  const tbody = document.querySelector('#cash-flow-table tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="px-4 py-2 text-center">Cargando movimientos...</td></tr>
    `;
  }
}

function updateStats() {
  // TODO: Actualizar métricas (total pagos, efectivo, etc.)
  console.log('Actualizando estadísticas');
  const totalPagos = state.allPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalEfectivo = state.allCashMovements
    .filter(m => m.type === 'efectivo' || m.type === 'reintegro')
    .reduce((sum, m) => sum + (m.amount || 0), 0);
  
  document.getElementById('total-pagos')?.textContent = 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalPagos);
  document.getElementById('total-efectivo')?.textContent = 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalEfectivo);
}

function showError(message) {
  // TODO: Mostrar error en la UI (toast, banner, etc.)
  console.error('Error:', message);
  // Ejemplo: crear un elemento de alerta temporal
  const alert = document.createElement('div');
  alert.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded';
  alert.role = 'alert';
  alert.innerHTML = `<span class="font-medium">${message}</span>`;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

// ====== EXISTING CODE (menú móvil, sidebar) ======
// Mantener su código existente de menú y sidebar
$('#sidebarToggle').addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('crm_sidebarCollapsed', sidebarCollapsed);
  $('#appShell').classList.toggle('sidebar-collapsed', sidebarCollapsed);
});

$('#mobileMenuBtn')?.addEventListener('click', () => {
  $('#appSidebar').classList.toggle('mobile-open');
  $('#sidebarOverlay').classList.toggle('hidden', !$('#appSidebar').classList.contains('mobile-open'));
});

$('#sidebarOverlay')?.addEventListener('click', () => {
  $('#appSidebar').classList.remove('mobile-open');
  $('#sidebarOverlay').classList.add('hidden');
});
