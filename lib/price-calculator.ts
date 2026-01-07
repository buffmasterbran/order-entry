// Helper functions for quantity-based pricing

import { Item, PriceBreak } from './supabase';

// Quantity tiers we use in the UI
export const QUANTITY_TIERS = [1, 24, 48, 192, 480, 960] as const;

// Mapping from NetSuite price_break_qty to actual quantities
// NetSuite uses: 1=QTY1 (base), 2=QTY1 (base), 3=QTY24, 4=QTY48, 5=QTY192, 6=QTY480, 7=QTY960
export const NETSUITE_QTY_MAPPING: Record<number, number> = {
  1: 1,    // Base price
  2: 1,    // Base price (some items use 2 for base)
  3: 24,   // First quantity break
  4: 48,   // Second quantity break
  5: 192,  // Third quantity break
  6: 480,  // Fourth quantity break
  7: 960,  // Fifth quantity break
};

/**
 * Map NetSuite price_break_qty to actual quantity
 */
export function mapNetSuiteQtyToQuantity(priceBreakQty: number): number {
  return NETSUITE_QTY_MAPPING[priceBreakQty] || priceBreakQty;
}

/**
 * Get the price for a given price level and total quantity
 * Returns the price from the highest quantity break that is <= totalQuantity
 */
export function getPriceForQuantity(
  item: Item,
  priceLevel: string,
  totalQuantity: number
): number | undefined {
  const breaks = item.price_breaks?.[priceLevel];
  if (!breaks || breaks.length === 0) {
    return undefined;
  }
  
  // Find the highest quantity break that is <= totalQuantity
  let selectedBreak: PriceBreak | null = null;
  for (const breakPoint of breaks) {
    if (breakPoint.quantity <= totalQuantity) {
      if (!selectedBreak || breakPoint.quantity > selectedBreak.quantity) {
        selectedBreak = breakPoint;
      }
    }
  }
  
  // If no break found, use the lowest quantity break (should be 1)
  return selectedBreak?.price ?? breaks[0]?.price;
}

/**
 * Get all price breaks for a given price level
 */
export function getPriceBreaksForLevel(item: Item, priceLevel: string): PriceBreak[] {
  return item.price_breaks?.[priceLevel] || [];
}

/**
 * Get the base price (quantity 1) for a given price level
 */
export function getBasePriceForLevel(item: Item, priceLevel: string): number | undefined {
  const breaks = item.price_breaks?.[priceLevel];
  if (!breaks || breaks.length === 0) {
    return undefined;
  }
  
  // Base price is at quantity 1
  const baseBreak = breaks.find(b => b.quantity === 1);
  return baseBreak?.price ?? breaks[0]?.price;
}
