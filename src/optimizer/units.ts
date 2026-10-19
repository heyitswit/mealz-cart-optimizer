import { PieceWeights, Quantity, Unit } from '../domain/types';

export type Dimension = 'mass' | 'volume' | 'count';

const DIMENSION: Record<Unit, Dimension> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  piece: 'count',
};

const TO_BASE: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  piece: 1,
};

export const BASE_UNIT: Record<Dimension, Unit> = {
  mass: 'g',
  volume: 'ml',
  count: 'piece',
};

export function dimensionOf(unit: Unit): Dimension {
  return DIMENSION[unit];
}

export function toBase(q: Quantity): number {
  return q.amount * TO_BASE[q.unit];
}

export function baseUnitOf(unit: Unit): Unit {
  return BASE_UNIT[dimensionOf(unit)];
}

// Only count<->mass is bridged (via piece weight); volume would need a density table we don't have.
export function convertAcrossDimension(
  q: Quantity,
  targetUnit: Unit,
  ingredientKey: string,
  pieceWeights: PieceWeights,
): Quantity | null {
  const from = dimensionOf(q.unit);
  const to = dimensionOf(targetUnit);
  if (from === to) return q;

  const pieceWeight = pieceWeights[ingredientKey];
  if (pieceWeight === undefined) return null;

  if (from === 'count' && to === 'mass') {
    return { amount: q.amount * pieceWeight, unit: 'g' };
  }
  if (from === 'mass' && to === 'count') {
    return { amount: toBase(q) / pieceWeight, unit: 'piece' };
  }
  return null;
}
