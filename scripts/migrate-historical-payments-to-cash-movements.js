/**
 * Rutina de migración manual para ejecutar desde la consola del navegador
 * con la app abierta (window.app ya inicializada y con acceso a Firestore).
 *
 * Uso:
 * 1) Abrir CRM en el navegador.
 * 2) Abrir DevTools > Console.
 * 3) Pegar este archivo y ejecutar:
 *      await migrateHistoricalPaymentsToCashMovements();
 */
async function migrateHistoricalPaymentsToCashMovements({ dryRun = true } = {}) {
  const { collection, getDocs, addDoc, query, where, Timestamp, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );
  const { db } = await import("./src/services/firebase.js");

  const paymentsSnapshot = await getDocs(collection(db, "pagos_productos"));
  let created = 0;
  let skipped = 0;

  for (const paymentDoc of paymentsSnapshot.docs) {
    const payment = paymentDoc.data();
    const paymentId = paymentDoc.id;
    const amount = Number(payment.totalPago ?? payment.totalAmount ?? 0);

    if (!amount) {
      skipped += 1;
      continue;
    }

    const existingMovementQuery = query(
      collection(db, "cash_movements"),
      where("sourcePaymentId", "==", paymentId),
      where("type", "==", "egreso")
    );

    const existingMovementSnapshot = await getDocs(existingMovementQuery);
    if (!existingMovementSnapshot.empty) {
      skipped += 1;
      continue;
    }

    const dateValue = payment.fecha || payment.date;
    const date = typeof dateValue === "string" ? new Date(`${dateValue}T12:00:00`) : dateValue?.toDate?.() || new Date();

    const movement = {
      type: "egreso",
      amount,
      date: Timestamp.fromDate(date),
      sourcePaymentId: paymentId,
      source: "migration",
      notes: "Generado por migración histórica desde pagos_productos",
      createdAt: serverTimestamp()
    };

    if (!dryRun) {
      await addDoc(collection(db, "cash_movements"), movement);
    }

    created += 1;
  }

  console.table({ dryRun, created, skipped, total: paymentsSnapshot.size });
  return { dryRun, created, skipped, total: paymentsSnapshot.size };
}

window.migrateHistoricalPaymentsToCashMovements = migrateHistoricalPaymentsToCashMovements;
