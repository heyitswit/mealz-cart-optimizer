import { describe, it, expect } from 'vitest';
import { scoreMatch, rankCandidates } from '../src/matching/matchProduct';
import { INGREDIENT_PROFILES } from '../src/matching/ingredientProfiles';

const butter = INGREDIENT_PROFILES.butter!;
const onion = INGREDIENT_PROFILES.onion!;

describe('scoreMatch — expected vs rejected categories', () => {
  it('scores a real butter high', () => {
    const r = scoreMatch(
      { externalId: '1', name: 'Beurre doux', categoriesTags: ['en:butters'] },
      butter,
    );
    expect(r.score).toBeGreaterThanOrEqual(0.8);
  });

  it('vetoes peanut butter despite the word "beurre"', () => {
    const r = scoreMatch(
      {
        externalId: '2',
        name: 'Pur beurre de cacahuète',
        categoriesTags: ['en:peanut-butters', 'en:nut-butters'],
      },
      butter,
    );
    expect(r.score).toBe(0);
  });

  it('does not count a sub-string category as a match', () => {
    const r = scoreMatch(
      {
        externalId: '3',
        name: 'Sauce provençale',
        categoriesTags: ['en:sauces', 'en:tomato-sauces-with-onions'],
      },
      onion,
    );
    expect(r.score).toBe(0);
  });
});

describe('rankCandidates — on realistic noisy input', () => {
  it('keeps real lardons and drops vegetal imitations', () => {
    const candidates = [
      {
        externalId: 'a',
        name: 'HERTA Lardons fumés',
        categoriesTags: ['en:lardons', 'en:pork-prepared'],
      },
      {
        externalId: 'b',
        name: 'Lardons végétaux fumés',
        categoriesTags: ['en:meat-analogues', 'en:plant-based-foods'],
      },
    ];
    const ranked = rankCandidates(candidates, INGREDIENT_PROFILES.lardon!);
    expect(ranked.map((r) => r.externalId)).toEqual(['a']);
  });

  it('returns candidates sorted best-first', () => {
    const candidates = [
      {
        externalId: 'weak',
        name: 'Tartine & Cuisine',
        categoriesTags: ['en:butters'],
      },
      {
        externalId: 'strong',
        name: 'Beurre doux',
        categoriesTags: ['en:butters'],
      },
    ];
    const ranked = rankCandidates(candidates, butter);
    expect(ranked[0]!.externalId).toBe('strong');
  });
});
