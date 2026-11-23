export const TAX_RATE = 0.07;

export function calculateTotals(subtotal: number) {
  let discountRate = 0;
  if (subtotal >= 1000) discountRate = 0.15;
  else if (subtotal >= 500) discountRate = 0.1;
  else if (subtotal >= 100) discountRate = 0.05;

  const discount = subtotal * discountRate;
  const tax = (subtotal - discount) * TAX_RATE;
  const total = subtotal - discount + tax;
  return { subtotal, discount, tax, total };
}
