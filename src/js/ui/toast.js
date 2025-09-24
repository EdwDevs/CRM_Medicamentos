const container = document.getElementById('toastContainer');

const ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  info: 'fa-circle-info'
};

/**
 * Muestra un toast accesible.
 * @param {string} message
 * @param {'success' | 'error' | 'info'} [type]
 */
export function showToast(message, type = 'success') {
  if (!container) {
    console.warn('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.dataset.type = type;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icon = document.createElement('i');
  icon.className = `app-toast__icon fa-solid ${ICONS[type] ?? ICONS.info}`;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('div');
  text.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.className = 'app-toast__close';
  closeButton.setAttribute('type', 'button');
  closeButton.setAttribute('aria-label', 'Cerrar notificación');
  closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeButton.addEventListener('click', () => removeToast(toast));

  toast.append(icon, text, closeButton);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => removeToast(toast), 4500);
}

function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-10px)';
  setTimeout(() => toast.remove(), 250);
}
