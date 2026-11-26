const nairaWhole = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const nairaFraction = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format an amount stored in kobo (integer) as Naira, e.g. 600000 -> "₦6,000".
 * Money is always stored as integer kobo, never floats.
 */
export function formatNaira(kobo: number): string {
  if (!Number.isInteger(kobo)) throw new RangeError("Amount must be an integer number of kobo");
  const naira = kobo / 100;
  return kobo % 100 === 0 ? nairaWhole.format(naira) : nairaFraction.format(naira);
}
