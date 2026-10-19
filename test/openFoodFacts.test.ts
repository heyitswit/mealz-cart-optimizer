import { describe, it, expect } from 'vitest';
import { parseQuantity } from '../src/catalog/openFoodFacts';

describe('parseQuantity', () => {
  it('parses simple grams', () => {
    expect(parseQuantity('500 g')).toEqual({ amount: 500, unit: 'g' });
  });
  it('converts kg to g', () => {
    expect(parseQuantity('1 kg')).toEqual({ amount: 1000, unit: 'g' });
  });
  it('converts litres and cl to ml', () => {
    expect(parseQuantity('1 L')).toEqual({ amount: 1000, unit: 'ml' });
    expect(parseQuantity('25 cl')).toEqual({ amount: 250, unit: 'ml' });
  });
  it('handles "6 x 125 g" multipacks', () => {
    expect(parseQuantity('6 x 125 g')).toEqual({ amount: 750, unit: 'g' });
  });
  it('handles comma decimals', () => {
    expect(parseQuantity('1,5 L')).toEqual({ amount: 1500, unit: 'ml' });
  });
  it('reads egg boxes sold by count', () => {
    expect(parseQuantity('6 œufs')).toEqual({ amount: 6, unit: 'piece' });
    expect(parseQuantity('x12')).toEqual({ amount: 12, unit: 'piece' });
    expect(parseQuantity('200')).toBeNull();
  });
  it('returns null for unreadable quantities', () => {
    expect(parseQuantity(undefined)).toBeNull();
    expect(parseQuantity('une pincée')).toBeNull();
  });
});
