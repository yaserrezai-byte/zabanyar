// ============================================================
// زبان‌یار | Adaptive placement test — question bank
// 36 calibrated items, A1 → C2, across 5 skills.
// ============================================================

import type { PlacementQuestion } from '@/types/db';

export const PLACEMENT_BANK: PlacementQuestion[] = [
  // ---------------- A1 ----------------
  { id: 'a1-g1', skill: 'grammar', level: 'A1', prompt: 'She ___ a teacher.', options: ['is', 'are', 'am', 'be'], correct_index: 0, explanation_fa: 'با فاعل سوم‌شخص مفرد (she) از is استفاده می‌کنیم.', error_tag: 'verb_to_be' },
  { id: 'a1-g2', skill: 'grammar', level: 'A1', prompt: 'I ___ coffee every morning.', options: ['drinks', 'drink', 'drinking', 'drank'], correct_index: 1, explanation_fa: 'با I در زمان حال ساده فعل بدون s می‌آید.', error_tag: 'present_simple' },
  { id: 'a1-g3', skill: 'grammar', level: 'A1', prompt: 'There ___ two books on the table.', options: ['is', 'are', 'was', 'be'], correct_index: 1, explanation_fa: 'برای جمع از there are استفاده می‌شود.', error_tag: 'there_be' },
  { id: 'a1-v1', skill: 'vocabulary', level: 'A1', prompt: 'The opposite of "big" is ___.', options: ['tall', 'small', 'long', 'wide'], correct_index: 1, explanation_fa: 'متضاد big کلمه small است.', error_tag: 'antonyms' },
  { id: 'a1-v2', skill: 'vocabulary', level: 'A1', prompt: 'We eat breakfast in the ___.', options: ['night', 'evening', 'morning', 'afternoon'], correct_index: 2, explanation_fa: 'صبحانه در morning خورده می‌شود.', error_tag: 'daily_words' },
  { id: 'a1-r1', skill: 'reading', level: 'A1', prompt: 'Read: "Tom has a red car. It is very fast." What colour is the car?', options: ['blue', 'red', 'green', 'black'], correct_index: 1, explanation_fa: 'در متن آمده red car.', error_tag: 'detail_reading' },

  // ---------------- A2 ----------------
  { id: 'a2-g1', skill: 'grammar', level: 'A2', prompt: 'Yesterday I ___ to the cinema.', options: ['go', 'goes', 'went', 'gone'], correct_index: 2, explanation_fa: 'yesterday نشانه گذشته ساده است؛ گذشته go می‌شود went.', error_tag: 'past_simple' },
  { id: 'a2-g2', skill: 'grammar', level: 'A2', prompt: 'He is ___ than his brother.', options: ['tall', 'taller', 'tallest', 'more tall'], correct_index: 1, explanation_fa: 'صفت تک‌هجایی با er تفضیلی می‌شود.', error_tag: 'comparatives' },
  { id: 'a2-g3', skill: 'grammar', level: 'A2', prompt: 'I have lived here ___ 2015.', options: ['for', 'since', 'from', 'during'], correct_index: 1, explanation_fa: 'با نقطه شروع زمانی از since استفاده می‌کنیم.', error_tag: 'since_for' },
  { id: 'a2-g4', skill: 'grammar', level: 'A2', prompt: 'There isn\'t ___ milk in the fridge.', options: ['some', 'any', 'many', 'a'], correct_index: 1, explanation_fa: 'در جملات منفی با اسم غیرقابل شمارش از any استفاده می‌شود.', error_tag: 'quantifiers' },
  { id: 'a2-v1', skill: 'vocabulary', level: 'A2', prompt: 'I need to ___ a decision.', options: ['do', 'make', 'take', 'get'], correct_index: 1, explanation_fa: 'ترکیب درست make a decision است.', error_tag: 'collocations' },
  { id: 'a2-l1', skill: 'listening', level: 'A2', prompt: 'Which word has a different vowel sound?', options: ['cat', 'hat', 'car', 'bat'], correct_index: 2, explanation_fa: 'در car صدای /ɑː/ است اما بقیه /æ/ دارند.', error_tag: 'vowel_sounds' },
  { id: 'a2-r1', skill: 'reading', level: 'A2', prompt: 'Read: "The shop opens at 9 and closes at 6, except Sunday." When is it closed?', options: ['Monday', 'Sunday', 'Saturday', 'Friday'], correct_index: 1, explanation_fa: 'کلمه except یعنی به‌جز؛ پس یکشنبه تعطیل است.', error_tag: 'inference' },

  // ---------------- B1 ----------------
  { id: 'b1-g1', skill: 'grammar', level: 'B1', prompt: 'If it ___ tomorrow, we will stay home.', options: ['rain', 'rains', 'will rain', 'rained'], correct_index: 1, explanation_fa: 'در شرطی نوع اول بعد از if از حال ساده استفاده می‌شود.', error_tag: 'conditional_1' },
  { id: 'b1-g2', skill: 'grammar', level: 'B1', prompt: 'The window ___ by the children.', options: ['broke', 'was broken', 'has broken', 'breaks'], correct_index: 1, explanation_fa: 'ساختار مجهول: was + past participle.', error_tag: 'passive_voice' },
  { id: 'b1-g3', skill: 'grammar', level: 'B1', prompt: 'She asked me where I ___.', options: ['live', 'lived', 'living', 'will live'], correct_index: 1, explanation_fa: 'در نقل قول غیرمستقیم زمان یک پله عقب می‌رود.', error_tag: 'reported_speech' },
  { id: 'b1-g4', skill: 'grammar', level: 'B1', prompt: 'I\'m used to ___ early.', options: ['wake', 'wake up', 'waking up', 'woke up'], correct_index: 2, explanation_fa: 'بعد از be used to فعل ing می‌گیرد.', error_tag: 'gerund_infinitive' },
  { id: 'b1-v1', skill: 'vocabulary', level: 'B1', prompt: 'The meeting was ___ because of the storm.', options: ['called off', 'called on', 'called up', 'called for'], correct_index: 0, explanation_fa: 'call off یعنی لغو کردن.', error_tag: 'phrasal_verbs' },
  { id: 'b1-v2', skill: 'vocabulary', level: 'B1', prompt: 'He is ___ in learning Japanese.', options: ['interesting', 'interested', 'interest', 'interests'], correct_index: 1, explanation_fa: 'برای احساس شخص از صفت ed استفاده می‌کنیم.', error_tag: 'ed_ing_adjectives' },
  { id: 'b1-w1', skill: 'writing', level: 'B1', prompt: 'Choose the best linking word: "It was raining; ___, we went out."', options: ['therefore', 'however', 'because', 'so'], correct_index: 1, explanation_fa: 'however برای تضاد به‌کار می‌رود.', error_tag: 'linkers' },
  { id: 'b1-r1', skill: 'reading', level: 'B1', prompt: 'Read: "Although the project was delayed, the team met the final deadline." What happened?', options: ['They missed it', 'They met the deadline', 'It was cancelled', 'It ended early'], correct_index: 1, explanation_fa: 'با وجود تأخیر، ضرب‌الاجل رعایت شد.', error_tag: 'concession' },

  // ---------------- B2 ----------------
  { id: 'b2-g1', skill: 'grammar', level: 'B2', prompt: 'If I ___ known, I would have come.', options: ['have', 'had', 'would have', 'has'], correct_index: 1, explanation_fa: 'شرطی نوع سوم: If + had + past participle.', error_tag: 'conditional_3' },
  { id: 'b2-g2', skill: 'grammar', level: 'B2', prompt: 'By next year, she ___ here for a decade.', options: ['will work', 'will be working', 'will have worked', 'works'], correct_index: 2, explanation_fa: 'آینده کامل برای مدت‌زمان تا نقطه‌ای در آینده.', error_tag: 'future_perfect' },
  { id: 'b2-g3', skill: 'grammar', level: 'B2', prompt: 'I\'d rather you ___ that.', options: ['don\'t do', 'didn\'t do', 'not do', 'won\'t do'], correct_index: 1, explanation_fa: 'بعد از would rather + فاعل، گذشته ساده می‌آید.', error_tag: 'unreal_past' },
  { id: 'b2-g4', skill: 'grammar', level: 'B2', prompt: 'Not only ___ late, but he also forgot the file.', options: ['he was', 'was he', 'he is', 'is he'], correct_index: 1, explanation_fa: 'با Not only در ابتدای جمله ساختار وارونه می‌شود.', error_tag: 'inversion' },
  { id: 'b2-v1', skill: 'vocabulary', level: 'B2', prompt: 'Her argument was quite ___; nobody could refute it.', options: ['fragile', 'compelling', 'trivial', 'vague'], correct_index: 1, explanation_fa: 'compelling یعنی متقاعدکننده.', error_tag: 'advanced_vocab' },
  { id: 'b2-v2', skill: 'vocabulary', level: 'B2', prompt: 'The company decided to ___ down on expenses.', options: ['cut', 'put', 'take', 'set'], correct_index: 0, explanation_fa: 'cut down on یعنی کاهش دادن.', error_tag: 'phrasal_verbs' },
  { id: 'b2-w1', skill: 'writing', level: 'B2', prompt: 'Which sentence is most formal?', options: ['We got the data.', 'The data was obtained.', 'We grabbed the data.', 'Data? We got it.'], correct_index: 1, explanation_fa: 'ساختار مجهول لحن رسمی‌تری دارد.', error_tag: 'register' },
  { id: 'b2-r1', skill: 'reading', level: 'B2', prompt: 'Read: "The policy, albeit controversial, yielded measurable benefits." The writer\'s tone is:', options: ['dismissive', 'balanced', 'hostile', 'humorous'], correct_index: 1, explanation_fa: 'albeit نشان می‌دهد نویسنده هر دو جنبه را دیده است.', error_tag: 'tone' },

  // ---------------- C1 ----------------
  { id: 'c1-g1', skill: 'grammar', level: 'C1', prompt: 'Seldom ___ such dedication.', options: ['we have seen', 'have we seen', 'we saw', 'did we saw'], correct_index: 1, explanation_fa: 'قیدهای منفی در ابتدای جمله باعث وارونگی می‌شوند.', error_tag: 'inversion' },
  { id: 'c1-g2', skill: 'grammar', level: 'C1', prompt: '___ for your help, we would have failed.', options: ['If not', 'Had it not been', 'Were not it', 'Unless'], correct_index: 1, explanation_fa: 'ساختار وارونه شرطی نوع سوم.', error_tag: 'inverted_conditional' },
  { id: 'c1-v1', skill: 'vocabulary', level: 'C1', prompt: 'His explanation only served to ___ the confusion.', options: ['alleviate', 'exacerbate', 'clarify', 'diminish'], correct_index: 1, explanation_fa: 'exacerbate یعنی بدتر کردن.', error_tag: 'advanced_vocab' },
  { id: 'c1-v2', skill: 'vocabulary', level: 'C1', prompt: 'The evidence was, at best, ___.', options: ['conclusive', 'tenuous', 'robust', 'definitive'], correct_index: 1, explanation_fa: 'tenuous یعنی سست و ضعیف.', error_tag: 'advanced_vocab' },
  { id: 'c1-r1', skill: 'reading', level: 'C1', prompt: 'Read: "The author\'s prose, ostensibly simple, conceals layers of meaning." "Ostensibly" means:', options: ['genuinely', 'apparently', 'rarely', 'deliberately'], correct_index: 1, explanation_fa: 'ostensibly یعنی ظاهراً.', error_tag: 'nuance' },

  // ---------------- C2 ----------------
  { id: 'c2-g1', skill: 'grammar', level: 'C2', prompt: 'Little ___ that the decision would alter everything.', options: ['he realised', 'did he realise', 'he did realise', 'realised he'], correct_index: 1, explanation_fa: 'Little در آغاز جمله وارونگی کامل می‌طلبد.', error_tag: 'inversion' },
  { id: 'c2-v1', skill: 'vocabulary', level: 'C2', prompt: 'Her remarks were widely seen as ___ criticism of the board.', options: ['blatant', 'oblique', 'candid', 'overt'], correct_index: 1, explanation_fa: 'oblique یعنی غیرمستقیم و کنایه‌آمیز.', error_tag: 'advanced_vocab' },
  { id: 'c2-w1', skill: 'writing', level: 'C2', prompt: 'Which best avoids nominalisation?', options: ['We made an assessment of the risk.', 'We assessed the risk.', 'An assessment of risk was made.', 'Risk assessment was undertaken.'], correct_index: 1, explanation_fa: 'استفاده از فعل مستقیم نوشتار را روان‌تر می‌کند.', error_tag: 'style' },
];

/** Adaptive selection: start mid-level, move up/down with performance. */
export function pickNextQuestion(
  answered: { level: string; correct: boolean }[],
  askedIds: string[]
): PlacementQuestion | null {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  let targetIdx = 1; // start at A2
  if (answered.length > 0) {
    const recent = answered.slice(-3);
    const lastLevel = answered[answered.length - 1].level;
    const base = order.indexOf(lastLevel);
    const hits = recent.filter((a) => a.correct).length;
    if (hits === recent.length) targetIdx = Math.min(base + 1, 5);
    else if (hits === 0) targetIdx = Math.max(base - 1, 0);
    else targetIdx = base;
  }

  for (let spread = 0; spread < 6; spread++) {
    for (const idx of [targetIdx + spread, targetIdx - spread]) {
      if (idx < 0 || idx > 5) continue;
      const pool = PLACEMENT_BANK.filter(
        (q) => q.level === order[idx] && !askedIds.includes(q.id)
      );
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return null;
}

export const PLACEMENT_LENGTH = 14;
