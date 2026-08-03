// ============================================================
// زبان‌یار | Option shuffling
//
// The hand-written question banks were authored with a strong
// positional bias: 78% of placement answers sat at index 1 (option B)
// and option D was never correct. A learner could score well by always
// picking B, which makes the adaptive placement result meaningless.
//
// Rather than hand-editing every literal (and re-introducing the bias
// the next time a question is added), options are shuffled at the
// moment a question is served, and the correct index is remapped to
// follow the answer to its new position.
// ============================================================

/** Fisher–Yates over a copy of `items`, returning the permutation used. */
function permutation(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Shuffle `options` and return the new list together with the index the
 * previously-correct option now occupies.
 *
 * Options whose text carries positional meaning (for example "همه موارد"
 * / "all of the above" / "هیچ‌کدام") are left in place, because moving
 * them would make the question nonsensical.
 */
export function shuffleOptions(
  options: string[],
  correctIndex: number
): { options: string[]; correctIndex: number } {
  if (!Array.isArray(options) || options.length < 2) {
    return { options: options ?? [], correctIndex };
  }
  if (correctIndex < 0 || correctIndex >= options.length) {
    return { options, correctIndex };
  }
  if (options.some(isPositionalOption)) {
    return { options, correctIndex };
  }

  const order = permutation(options.length);
  const shuffled = order.map((i) => options[i]);
  const newCorrect = order.indexOf(correctIndex);

  return { options: shuffled, correctIndex: newCorrect };
}

const POSITIONAL =
  /^(—|all of the above|none of the above|both a and b|همه[ٔ‌ ]?\s*موارد|هیچ[‌ ]?کدام|هر\s*دو)/i;

function isPositionalOption(opt: string): boolean {
  return POSITIONAL.test((opt ?? '').trim());
}

/** Shuffle a placement-bank question in place-safe fashion. */
export function shuffleQuestion<
  T extends { options: string[]; correct_index: number },
>(q: T): T {
  const { options, correctIndex } = shuffleOptions(q.options, q.correct_index);
  return { ...q, options, correct_index: correctIndex };
}

/** Shuffle a generated lesson exercise (uses `correct_answer`). */
export function shuffleExercise<
  T extends { options?: string[] | null; correct_answer: number },
>(ex: T): T {
  if (!ex.options?.length) return ex;
  const { options, correctIndex } = shuffleOptions(ex.options, ex.correct_answer);
  return { ...ex, options, correct_answer: correctIndex };
}
