import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const loadPayments = (db, onData, onError) => {
  const qPagosProductos = query(collection(db, "pagos_productos"));
  return onSnapshot(
    qPagosProductos,
    (snapshot) => {
      console.group("--- Documentos de pagos_productos ---");
      if (snapshot.empty) {
        console.log("La colección está vacía.");
      } else {
        snapshot.docs.forEach((paymentDoc) => {
          console.log(`ID: ${paymentDoc.id}`, paymentDoc.data());
        });
      }
      console.groupEnd();

      const rawData = snapshot.docs.map((paymentDoc) => {
        const data = paymentDoc.data();

        const parseDate = (value) => {
          if (!value) return Timestamp.now();
          if (value.toDate) return value;
          if (typeof value === "string") return value;
          return value;
        };

        const normalizeProd = (value) => {
          if (!value) return "descongel";
          const lower = value.toLowerCase();
          if (lower.includes("400")) return "multidol400";
          if (lower.includes("800")) return "multidol800";
          if (lower.includes("descongel")) return "descongel";
          return "multidol400";
        };

        return {
          id: paymentDoc.id,
          ...data,
          pharmacy: data.cliente || data.pharmacy || "Farmacia General",
          totalAmount: Number(data.totalPago) || Number(data.totalAmount) || 0,
          date: parseDate(data.fecha || data.date),
          product: normalizeProd(data.producto || data.product),
          quantity: Number(data.cajasPagadas) || Number(data.quantity) || 1,
          unitPrice: Number(data.valorUnitario) || Number(data.unitPrice) || 0,
          status: data.status || "procesado"
        };
      });

      const getTime = (value) => {
        if (value && value.toMillis) return value.toMillis();
        if (value instanceof Date) return value.getTime();
        if (typeof value === "string") return new Date(value).getTime();
        return 0;
      };

      onData(rawData.sort((a, b) => getTime(b.date) - getTime(a.date)));
    },
    onError
  );
};

export const getCashMovements = (db, onData) => {
  const qMovements = query(collection(db, "cash_movements"));
  return onSnapshot(qMovements, (snapshot) => {
    onData(snapshot.docs.map((movementDoc) => ({ id: movementDoc.id, ...movementDoc.data() })));
  });
};

export const subscribePaymentReferences = (db, onData) => {
  const qPaymentReferences = query(collection(db, "payment_references"));
  return onSnapshot(qPaymentReferences, (snapshot) => {
    onData(
      snapshot.docs.map((paymentReferenceDoc) => ({
        id: paymentReferenceDoc.id,
        ...paymentReferenceDoc.data()
      }))
    );
  });
};

export const createPaymentReference = async (db, pharmacy, reference, normalizeText) => {
  const duplicateQuery = query(collection(db, "payment_references"), where("pharmacy", "==", pharmacy));
  const duplicateSnapshot = await getDocs(duplicateQuery);
  const duplicatedInDb = duplicateSnapshot.docs.some((paymentReferenceDoc) => {
    const data = paymentReferenceDoc.data();
    return normalizeText(data.reference) === normalizeText(reference);
  });

  if (duplicatedInDb) return false;

  await addDoc(collection(db, "payment_references"), {
    pharmacy,
    reference,
    active: true,
    createdAt: serverTimestamp()
  });

  return true;
};

export const savePayment = (db, newPayment) => addDoc(collection(db, "pagos_productos"), newPayment);

export const saveReintegro = (db, movement) => addDoc(collection(db, "cash_movements"), movement);

export const buildReintegroMovement = ({ amount, dateVal, refIds, notes }) => ({
  type: "reintegro",
  amount,
  date: Timestamp.fromDate(new Date(`${dateVal}T12:00:00`)),
  referencePaymentIds: refIds,
  notes,
  createdAt: serverTimestamp()
});

export const togglePaymentStatus = (db, id, newStatus) => updateDoc(doc(db, "pagos_productos", id), { status: newStatus });

export const deletePayment = (db, id) => deleteDoc(doc(db, "pagos_productos", id));
