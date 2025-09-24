import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  Timestamp,
  getAggregateFromServer,
  sum
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { db, FALLBACK_BUDGET } from '../firebase.js';
import { STATUS_OPTIONS } from '../config/app.js';
import { normalizeText } from '../utils/format.js';

const PAYMENTS_COLLECTION = collection(db, 'payments');
const BUDGET_DOC_REF = doc(db, 'settings', 'budget');
const STATS_DOC_REF = doc(db, 'stats', 'payments');

const STATUS_VALUES = STATUS_OPTIONS.map((item) => item.value);

/**
 * @typedef {Object} PaymentRecord
 * @property {string} id
 * @property {string} pharmacy
 * @property {string} product
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} totalAmount
 * @property {Date} date
 * @property {string} status
 * @property {string} notes
 */

/**
 * Obtiene la lista de pagos respetando los filtros y paginación.
 * @param {{
 *  pageSize: number,
 *  cursor?: import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js').QueryDocumentSnapshot,
 *  filters: { product?: string; status?: string; month?: string; pharmacy?: string; }
 * }} options
 */
export async function fetchPayments({ pageSize, cursor, filters }) {
  const baseConstraints = [];

  if (filters?.product) {
    baseConstraints.push(where('product', '==', filters.product));
  }

  if (filters?.status && STATUS_VALUES.includes(filters.status)) {
    baseConstraints.push(where('status', '==', filters.status));
  }

  if (filters?.month) {
    const [year, month] = filters.month.split('-');
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    baseConstraints.push(where('date', '>=', Timestamp.fromDate(startDate)));
    baseConstraints.push(where('date', '<', Timestamp.fromDate(endDate)));
  }

  if (filters?.pharmacy) {
    baseConstraints.push(where('pharmacyKey', '==', normalizeText(filters.pharmacy)));
  }

  baseConstraints.push(orderBy('date', 'desc'));

  const queryConstraints = [...baseConstraints];

  if (cursor) {
    queryConstraints.push(startAfter(cursor));
  }

  queryConstraints.push(limit(pageSize));

  const paymentsQuery = query(PAYMENTS_COLLECTION, ...queryConstraints);
  const snapshot = await getDocs(paymentsQuery);

  const payments = snapshot.docs.map(mapPaymentDocument);
  const firstVisible = snapshot.docs.at(0) ?? null;
  const lastVisible = snapshot.docs.at(-1) ?? null;

  const baseQuery = query(PAYMENTS_COLLECTION, ...baseConstraints);

  const countSnapshot = await getCountFromServer(baseQuery);
  const total = countSnapshot.data().count;
  const statsData = await ensureStatsDocument();

  return {
    payments,
    pagination: {
      total,
      firstVisible,
      lastVisible,
      hasNext: Boolean(lastVisible) && payments.length === pageSize
    },
    totals: {
      totalSpent: statsData.totalSpent ?? 0,
      counts: {
        pendiente: statsData.pendingCount ?? 0,
        procesado: statsData.processedCount ?? 0
      }
    }
  };
}

export async function ensureStatsDocument() {
  const statsSnap = await getDoc(STATS_DOC_REF);
  if (statsSnap.exists()) {
    return statsSnap.data();
  }

  const [aggregate, pendingCountSnap, processedCountSnap] = await Promise.all([
    getAggregateFromServer(PAYMENTS_COLLECTION, { totalSpent: sum('totalAmount') }),
    getCountFromServer(query(PAYMENTS_COLLECTION, where('status', '==', 'pendiente'))),
    getCountFromServer(query(PAYMENTS_COLLECTION, where('status', '==', 'procesado')))
  ]);

  let totalSpent = aggregate.data().totalSpent ?? 0;
  if (!totalSpent) {
    const fallbackAggregate = await getAggregateFromServer(PAYMENTS_COLLECTION, { fallbackTotal: sum('amount') });
    totalSpent = fallbackAggregate.data().fallbackTotal ?? 0;
  }

  const payload = {
    totalSpent,
    pendingCount: pendingCountSnap.data().count ?? 0,
    processedCount: processedCountSnap.data().count ?? 0,
    updatedAt: serverTimestamp()
  };

  await setDoc(STATS_DOC_REF, payload);
  return payload;
}

export async function createPayment(payload) {
  const paymentData = normalizePaymentPayload(payload);

  const paymentId = await runTransaction(db, async (transaction) => {
    const [budgetSnap, statsSnap] = await Promise.all([
      transaction.get(BUDGET_DOC_REF),
      transaction.get(STATS_DOC_REF)
    ]);

    const budgetAmount = budgetSnap.exists() && typeof budgetSnap.data().amount === 'number'
      ? budgetSnap.data().amount
      : FALLBACK_BUDGET;

    const statsData = statsSnap.exists()
      ? statsSnap.data()
      : { totalSpent: 0, pendingCount: 0, processedCount: 0 };

    const available = budgetAmount - (statsData.totalSpent ?? 0);
    if (paymentData.totalAmount > available) {
      throw new Error('INSUFFICIENT_BUDGET');
    }

    const docRef = doc(PAYMENTS_COLLECTION);
    transaction.set(docRef, {
      ...paymentData,
      createdAt: serverTimestamp(),
      pharmacyKey: normalizeText(paymentData.pharmacy)
    });

    transaction.set(STATS_DOC_REF, {
      totalSpent: (statsData.totalSpent ?? 0) + paymentData.totalAmount,
      pendingCount: (statsData.pendingCount ?? 0) + (paymentData.status === 'pendiente' ? 1 : 0),
      processedCount: (statsData.processedCount ?? 0) + (paymentData.status === 'procesado' ? 1 : 0),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return docRef.id;
  });

  return paymentId;
}

export async function deletePayment(id) {
  await runTransaction(db, async (transaction) => {
    const paymentRef = doc(PAYMENTS_COLLECTION, id);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error('NOT_FOUND');
    }

    const payment = paymentSnap.data();
    transaction.delete(paymentRef);

    const statsSnap = await transaction.get(STATS_DOC_REF);
    const statsData = statsSnap.exists()
      ? statsSnap.data()
      : { totalSpent: 0, pendingCount: 0, processedCount: 0 };

    transaction.set(STATS_DOC_REF, {
      totalSpent: Math.max((statsData.totalSpent ?? 0) - (payment.totalAmount ?? 0), 0),
      pendingCount: Math.max((statsData.pendingCount ?? 0) - (payment.status === 'pendiente' ? 1 : 0), 0),
      processedCount: Math.max((statsData.processedCount ?? 0) - (payment.status === 'procesado' ? 1 : 0), 0),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
}

export async function togglePaymentStatus(id) {
  return runTransaction(db, async (transaction) => {
    const paymentRef = doc(PAYMENTS_COLLECTION, id);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error('NOT_FOUND');
    }

    const payment = paymentSnap.data();
    const newStatus = payment.status === 'pendiente' ? 'procesado' : 'pendiente';

    transaction.update(paymentRef, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    const statsSnap = await transaction.get(STATS_DOC_REF);
    const statsData = statsSnap.exists()
      ? statsSnap.data()
      : { totalSpent: 0, pendingCount: 0, processedCount: 0 };

    transaction.set(STATS_DOC_REF, {
      pendingCount: Math.max((statsData.pendingCount ?? 0) + (newStatus === 'pendiente' ? 1 : -1), 0),
      processedCount: Math.max((statsData.processedCount ?? 0) + (newStatus === 'procesado' ? 1 : -1), 0),
      totalSpent: statsData.totalSpent ?? 0,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return newStatus;
  });
}

export async function getPayment(id) {
  const snapshot = await getDoc(doc(PAYMENTS_COLLECTION, id));
  if (!snapshot.exists()) {
    throw new Error('NOT_FOUND');
  }
  return mapPaymentDocument(snapshot);
}

function mapPaymentDocument(document) {
  const data = document.data();
  return {
    id: document.id,
    pharmacy: data.pharmacy,
    product: data.product,
    quantity: data.quantity ?? 1,
    unitPrice: data.unitPrice ?? data.amount ?? 0,
    totalAmount: data.totalAmount ?? data.amount ?? 0,
    date: data.date instanceof Timestamp ? data.date.toDate() : data.date?.toDate?.() ?? new Date(data.date),
    status: STATUS_VALUES.includes(data.status) ? data.status : 'pendiente',
    notes: data.notes ?? ''
  };
}

function normalizePaymentPayload(payload) {
  const date = payload.date instanceof Date ? payload.date : new Date(`${payload.date}T00:00:00`);
  const quantity = Number(payload.quantity);
  const unitPrice = Number(payload.unitPrice);
  const totalAmount = Number(payload.totalAmount ?? unitPrice * quantity);
  return {
    pharmacy: payload.pharmacy.trim(),
    product: payload.product,
    quantity,
    unitPrice,
    totalAmount,
    amount: totalAmount,
    date: Timestamp.fromDate(date),
    status: STATUS_VALUES.includes(payload.status) ? payload.status : 'pendiente',
    notes: payload.notes?.trim() ?? ''
  };
}
