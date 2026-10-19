import {
  IngredientProfile,
  matchesWholeWord,
  normalize,
} from './ingredientProfiles';

export interface MatchCandidate {
  externalId: string;
  name: string;
  categoriesTags?: string[];
  hasPrice?: boolean;
}

export interface MatchScore {
  score: number;
  reasons: string[];
}

// Additive score: +0.6 expected category, +0.2 name term, -0.9 rejected category, -0.5 rejected word, clamped to [0, 1].
export function scoreMatch(
  candidate: MatchCandidate,
  profile: IngredientProfile,
): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  // Whole-slug match so "tomato-sauces-with-onions" doesn't count as "onions".
  const tags = (candidate.categoriesTags ?? []).map((t) =>
    t.toLowerCase().replace(/^[a-z]{2}:/, ''),
  );
  const name = normalize(candidate.name);
  const hasTag = (wanted: string) => tags.includes(wanted.toLowerCase());

  const nameHasTerm = profile.nameTerms.some((term) =>
    matchesWholeWord(name, normalize(term)),
  );

  const hasExpected = profile.expectCategories.some(hasTag);
  if (hasExpected) {
    score += 0.6;
    reasons.push('matches a specific expected category');
  }

  const hasWeak = (profile.weakCategories ?? []).some(hasTag);
  if (hasWeak && nameHasTerm && !hasExpected) {
    score += 0.6;
    reasons.push('broad category confirmed by the product name');
  }

  if (nameHasTerm) {
    score += 0.2;
    reasons.push('name contains the ingredient term');
  }

  const rejectedCat = profile.rejectCategories.find((rej) =>
    tags.some((t) => t.includes(rej)),
  );
  if (rejectedCat) {
    score -= 0.9;
    reasons.push(`rejected category "${rejectedCat}"`);
  }

  const rejectedWord = profile.rejectNameWords.find((w) =>
    name.includes(normalize(w)),
  );
  if (rejectedWord) {
    score -= 0.5;
    reasons.push(`name contains "${rejectedWord}"`);
  }

  const clamped = Math.max(0, Math.min(1, score));
  return { score: +clamped.toFixed(2), reasons };
}

export function rankCandidates(
  candidates: MatchCandidate[],
  profile: IngredientProfile,
  threshold = 0.5,
): Array<MatchCandidate & MatchScore> {
  return candidates
    .map((c) => ({ ...c, ...scoreMatch(c, profile) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => {
      // Tie-break on known price: a priced product is the one actually sold in France.
      if (b.score !== a.score) return b.score - a.score;
      const ap = a.hasPrice ? 1 : 0;
      const bp = b.hasPrice ? 1 : 0;
      return bp - ap;
    });
}
