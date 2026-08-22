export const getProductConfig = (prod) => {
  const map = {
    descongel: { label: "Descongel", badge: "badge-descongel", icon: "fa-snowflake" },
    multidol400: { label: "Multidol 400", badge: "badge-multidol400", icon: "fa-pills" },
    multidol800: { label: "Multidol 800", badge: "badge-multidol800", icon: "fa-capsules" }
  };

  return map[prod] || { label: prod, badge: "bg-secondary text-white", icon: "fa-box" };
};

export const getAvailablePaymentReferencesByPharmacy = (paymentReferences, pharmacy, normalizeText) => {
  const normalizedPharmacy = normalizeText(pharmacy);
  if (!normalizedPharmacy) return [];

  return paymentReferences
    .filter((ref) => ref.active !== false && normalizeText(ref.pharmacy) === normalizedPharmacy)
    .map((ref) => ({ id: ref.id, reference: ref.reference }))
    .sort((a, b) => a.reference.localeCompare(b.reference, "es"));
};
