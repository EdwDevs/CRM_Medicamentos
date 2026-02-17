# Migración de pagos históricos a `cash_movements`

## Objetivo
Convertir pagos históricos (`pagos_productos`) en movimientos de caja de tipo `egreso` para que el dashboard utilice `cash_movements` como fuente principal.

## Script
Archivo: `scripts/migrate-historical-payments-to-cash-movements.js`

La rutina:
- Recorre todos los documentos de `pagos_productos`.
- Valida que el pago tenga valor total (`totalPago` / `totalAmount`).
- Verifica si ya existe un movimiento `cash_movements` con `sourcePaymentId` del pago.
- Crea movimiento `type: "egreso"` cuando haga falta.

## Ejecución recomendada (manual, desde navegador)
1. Abrir la aplicación CRM en un entorno con permisos de escritura sobre Firestore.
2. Abrir DevTools > Console.
3. Pegar el contenido de `scripts/migrate-historical-payments-to-cash-movements.js`.
4. Ejecutar prueba sin escritura:
   ```js
   await migrateHistoricalPaymentsToCashMovements({ dryRun: true });
   ```
5. Revisar conteo (`created`, `skipped`, `total`).
6. Ejecutar migración real:
   ```js
   await migrateHistoricalPaymentsToCashMovements({ dryRun: false });
   ```

## Validación post-migración
- Confirmar que para el mes auditado existen `cash_movements` de tipo `egreso`.
- Confirmar que el indicador del dashboard cambie a **Datos migrados** (sin fallback legacy).
