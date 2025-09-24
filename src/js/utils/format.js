/**
 * Formatea un número como moneda colombiana.
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  if (Number.isNaN(value) || value === undefined || value === null) {
    return '$0';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Formatea un objeto Date o timestamp ISO a un formato corto en español.
 * @param {Date | string} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase();
}
