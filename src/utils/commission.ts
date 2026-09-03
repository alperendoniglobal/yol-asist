/**
 * KDV oranı (%20). Satış fiyatları (`price`) KDV dahil tutulur;
 * komisyon KDV hariç net fiyat üzerinden hesaplanır.
 */
export const VAT_RATE = 0.20;
export const VAT_DIVISOR = 1 + VAT_RATE;

/** KDV dahil fiyattan KDV hariç net fiyatı çıkarır. */
export function toNetPrice(priceWithVat: number): number {
  return priceWithVat / VAT_DIVISOR;
}

/** KDV hariç net fiyat üzerinden komisyon tutarını hesaplar. */
export function calculateCommissionAmount(priceWithVat: number, commissionRatePercent: number): number {
  return (toNetPrice(priceWithVat) * commissionRatePercent) / 100;
}
