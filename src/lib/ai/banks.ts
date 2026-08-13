// ============================================================
// زبان‌یار | Content bank dispatch
//
// One entry point for "give me content for language X". Callers
// (API routes, engines) must never import a language-specific bank
// directly, so adding a language stays a one-file change.
// ============================================================

import type { LearningLanguage } from '@/lib/languages';
import type { CefrLevel, PlacementQuestion } from '@/types/db';

import { PLACEMENT_BANK, pickNextQuestion, PLACEMENT_LENGTH } from './placement-bank';
import { PLACEMENT_BANK_ES, pickNextQuestionEs } from './placement-bank-es';
import { SENTENCE_BANK, sentencesForLevel } from './pronunciation-engine';
import { SENTENCE_BANK_ES, sentencesForLevelEs } from './pronunciation-es';

export { PLACEMENT_LENGTH };

/** The full placement bank for a language (used by tests and admin). */
export function placementBank(language: LearningLanguage): PlacementQuestion[] {
  return language === 'es' ? PLACEMENT_BANK_ES : PLACEMENT_BANK;
}

/** Adaptive next-question picker for a language. */
export function pickQuestion(
  language: LearningLanguage,
  answered: { level: string; correct: boolean }[],
  askedIds: string[]
): PlacementQuestion | null {
  return language === 'es'
    ? pickNextQuestionEs(answered, askedIds)
    : pickNextQuestion(answered, askedIds);
}

/** Full pronunciation sentence bank for a language. */
export function sentenceBank(language: LearningLanguage) {
  return language === 'es' ? SENTENCE_BANK_ES : SENTENCE_BANK;
}

/** Level-filtered pronunciation practice set for a language. */
export function sentencesForLevelIn(
  language: LearningLanguage,
  level: CefrLevel | null
) {
  return language === 'es' ? sentencesForLevelEs(level) : sentencesForLevel(level);
}
