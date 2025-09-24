import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAnalytics, isSupported as analyticsIsSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { DEFAULT_BUDGET } from './config/app.js';

const firebaseConfig = window.__FIREBASE_CONFIG__;

if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
  throw new Error('No se encontró la configuración de Firebase. Copia "firebase-config.sample.js" como "firebase-config.js" e incluye tus credenciales.');
}

export const app = initializeApp(firebaseConfig);

try {
  if (typeof analyticsIsSupported === 'function') {
    analyticsIsSupported().then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    }).catch(() => {});
  } else {
    getAnalytics(app);
  }
} catch (error) {
  console.warn('Analytics no disponible:', error);
}

export const db = getFirestore(app);

export const FALLBACK_BUDGET = DEFAULT_BUDGET;
