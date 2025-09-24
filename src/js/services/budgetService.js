import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  collection,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { db, FALLBACK_BUDGET } from '../firebase.js';

const BUDGET_DOC_REF = doc(db, 'settings', 'budget');
const RELOADS_COLLECTION = collection(db, 'budget_reloads');

export async function fetchBudget() {
  const snapshot = await getDoc(BUDGET_DOC_REF);
  if (!snapshot.exists()) {
    await setDoc(BUDGET_DOC_REF, {
      amount: FALLBACK_BUDGET,
      updatedAt: serverTimestamp()
    });
    return FALLBACK_BUDGET;
  }
  const data = snapshot.data();
  return typeof data.amount === 'number' ? data.amount : FALLBACK_BUDGET;
}

export async function reloadBudget({ amount, notes }) {
  const result = await runTransaction(db, async (transaction) => {
    const budgetSnap = await transaction.get(BUDGET_DOC_REF);
    const currentAmount = budgetSnap.exists() && typeof budgetSnap.data().amount === 'number'
      ? budgetSnap.data().amount
      : FALLBACK_BUDGET;
    const newAmount = currentAmount + amount;

    transaction.set(BUDGET_DOC_REF, {
      amount: newAmount,
      updatedAt: serverTimestamp()
    });

    const reloadDoc = doc(RELOADS_COLLECTION);
    transaction.set(reloadDoc, {
      amount,
      notes: notes || '',
      previousTotal: currentAmount,
      newTotal: newAmount,
      createdAt: serverTimestamp()
    });

    return { previousTotal: currentAmount, newTotal: newAmount };
  });

  return result;
}
