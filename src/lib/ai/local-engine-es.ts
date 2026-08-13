// ============================================================
// زبان‌یار | Spanish local engine
//
// Deterministic Spanish support so the language works with no AI key,
// exactly like the English engine. Targets the errors a Persian speaker
// actually makes, which are structurally different from English ones:
// gender, ser/estar, conjugation, and the subjunctive.
// ============================================================

import type { CefrLevel, SkillKind, VocabSeed } from '@/types/db';

export interface EsRule {
  re: RegExp;
  tag: string;
  skill: SkillKind;
  note_fa: string;
  fix?: (m: RegExpExecArray) => string;
}

/**
 * Common, mechanically-detectable Spanish errors.
 * Deliberately conservative: a false correction is worse than a miss.
 */
export const ES_RULES: EsRule[] = [
  // "soy cansado" -> estar for transient states
  {
    re: /\b(soy|eres|es|somos|son)\s+(cansad[oa]s?|enfadad[oa]s?|content[oa]s?|triste|ocupad[oa]s?|enferm[oa]s?|list[oa]s?)\b/gi,
    tag: 'ser_estar',
    skill: 'grammar',
    note_fa: 'برای حالت‌های موقت (خستگی، ناراحتی، مشغول بودن) از estar استفاده می‌شود نه ser.',
    fix: (m) => {
      const map: Record<string, string> = {
        soy: 'estoy', eres: 'estás', es: 'está', somos: 'estamos', son: 'están',
      };
      return `${map[m[1].toLowerCase()] ?? m[1]} ${m[2]}`;
    },
  },
  // "el mesa" -> gender agreement on very common feminine nouns
  {
    re: /\bel\s+(mesa|casa|silla|puerta|ventana|escuela|ciudad|familia|persona|semana|hora|vida|agua fría)\b/gi,
    tag: 'gender_agreement',
    skill: 'grammar',
    note_fa: 'این اسم مؤنث است و حرف تعریف «la» می‌گیرد. در فارسی جنسیت دستوری نداریم، پس باید جنسیت هر اسم را همراه خودش یاد بگیرید.',
    fix: (m) => `la ${m[1]}`,
  },
  {
    re: /\bla\s+(libro|coche|problema|día|mapa|hombre|país|trabajo|dinero)\b/gi,
    tag: 'gender_agreement',
    skill: 'grammar',
    note_fa: 'این اسم مذکر است و حرف تعریف «el» می‌گیرد. دقت کنید که problema، día و mapa با اینکه به a ختم می‌شوند مذکرند.',
    fix: (m) => `el ${m[1]}`,
  },
  // "yo gusto" -> gustar is inverted
  {
    re: /\byo\s+gusto\b/gi,
    tag: 'gustar_structure',
    skill: 'grammar',
    note_fa: 'فعل gustar وارونه است: «A mí me gusta …» یعنی چیزی برای من خوشایند است. «yo gusto» یعنی «من خوشایندم».',
    fix: () => 'me gusta',
  },
  // "es necesario que + indicative" -> subjunctive
  {
    re: /\b(es necesario que|espero que|quiero que|ojalá que)\s+(\w+)(as|es|amos|emos|áis|éis|an|en)?\s/gi,
    tag: 'subjunctive_present',
    skill: 'grammar',
    note_fa: 'بعد از عبارت‌هایی مثل espero que و es necesario que باید وجه التزامی (subjuntivo) بیاید.',
  },
  // Persian speakers often drop the personal "a"
  {
    re: /\b(veo|vi|conozco|conocí|llamo|llamé|busco|busqué)\s+(mi|tu|su|el|la)\s+(madre|padre|amigo|amiga|hermano|hermana|profesor|profesora)\b/gi,
    tag: 'personal_a',
    skill: 'grammar',
    note_fa: 'وقتی مفعول مستقیم یک «شخص» است، باید حرف اضافه «a» بیاید: veo a mi madre.',
    fix: (m) => `${m[1]} a ${m[2]} ${m[3]}`,
  },
  // double negative is REQUIRED in Spanish — flag the English-style fix
  {
    re: /\bno\s+\w+\s+(algo|alguien|alguno)\b/gi,
    tag: 'double_negative_es',
    skill: 'grammar',
    note_fa: 'در اسپانیایی برخلاف انگلیسی، منفی دوگانه لازم است: «no veo nada» نه «no veo algo».',
  },
  // missing inverted opening marks
  {
    re: /(^|\s)(?!¿)[A-ZÁÉÍÓÚÑ][^.?!]*\?/gm,
    tag: 'punctuation_es',
    skill: 'writing',
    note_fa: 'در اسپانیایی جمله پرسشی با «¿» باز می‌شود: ¿Cómo estás?',
  },
  {
    re: /(^|\s)(?!¡)[A-ZÁÉÍÓÚÑ][^.?!]*!/gm,
    tag: 'punctuation_es',
    skill: 'writing',
    note_fa: 'در اسپانیایی جمله تعجبی با «¡» باز می‌شود: ¡Qué bien!',
  },
  // "estoy de acuerdo" is right; "soy de acuerdo" is a classic transfer error
  {
    re: /\b(soy|eres|es|somos|son)\s+de acuerdo\b/gi,
    tag: 'ser_estar',
    skill: 'grammar',
    note_fa: 'عبارت درست «estar de acuerdo» است: estoy de acuerdo.',
    fix: (m) => {
      const map: Record<string, string> = {
        soy: 'estoy', eres: 'estás', es: 'está', somos: 'estamos', son: 'están',
      };
      return `${map[m[1].toLowerCase()] ?? m[1]} de acuerdo`;
    },
  },
  // tener, not ser, for age
  {
    re: /\b(soy|eres|es|somos|son)\s+(\d{1,2})\s*(años)?\b/gi,
    tag: 'tener_age',
    skill: 'grammar',
    note_fa: 'در اسپانیایی سن با فعل tener بیان می‌شود: tengo 25 años.',
  },
];

export interface EsDetected {
  wrong: string;
  right: string;
  note_fa: string;
  error_tag: string;
  skill: SkillKind;
}

/** Run the Spanish rule set over a learner's text. */
export function detectErrorsEs(text: string): EsDetected[] {
  const found: EsDetected[] = [];
  const seen = new Set<string>();

  for (const rule of ES_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const wrong = m[0].trim();
      const key = `${rule.tag}:${wrong.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        wrong,
        right: rule.fix ? rule.fix(m).trim() : wrong,
        note_fa: rule.note_fa,
        error_tag: rule.tag,
        skill: rule.skill,
      });
      if (found.length >= 6) return found;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return found;
}

// ------------------------------------------------------------
// Spanish lesson templates (local fallback)
// ------------------------------------------------------------
interface EsLessonTemplate {
  title: string;
  title_fa: string;
  summary_fa: string;
  sections: {
    heading_fa: string;
    body_fa: string;
    examples: { en: string; fa: string }[];
    tip_fa: string;
  }[];
  vocabulary: VocabSeed[];
  exercises: {
    kind: 'mcq' | 'fill_blank';
    prompt: string;
    prompt_fa: string;
    options: string[];
    correct_answer: number;
    explanation_fa: string;
    error_tag: string;
  }[];
}

export const ES_LESSON_TEMPLATES: Record<string, EsLessonTemplate> = {
  ser_estar: {
    title: 'Ser y Estar',
    title_fa: 'تفاوت ser و estar',
    summary_fa: 'دو فعل «بودن» در اسپانیایی و اینکه کِی کدام را به کار ببریم.',
    sections: [
      {
        heading_fa: 'چرا دو فعل «بودن»؟',
        body_fa: 'در فارسی فقط یک «است» داریم، اما اسپانیایی دو فعل دارد. ser برای ویژگی‌های ثابت و ذاتی (هویت، ملیت، شغل، شخصیت) و estar برای حالت‌های موقت و مکان به‌کار می‌رود.',
        examples: [
          { en: 'Soy iraní. (هویت ثابت)', fa: 'من ایرانی هستم.' },
          { en: 'Estoy cansado. (حالت موقت)', fa: 'من خسته‌ام.' },
        ],
        tip_fa: 'یک تست ساده: اگر ویژگی با گذر زمان عوض می‌شود، estar بگیرید.',
      },
      {
        heading_fa: 'صرف هر دو فعل',
        body_fa: 'ser: soy, eres, es, somos, sois, son — estar: estoy, estás, está, estamos, estáis, están. هر دو بی‌قاعده‌اند و باید حفظ شوند.',
        examples: [
          { en: 'Ella es profesora.', fa: 'او معلم است.' },
          { en: 'Ella está en casa.', fa: 'او خانه است.' },
        ],
        tip_fa: 'مکان همیشه با estar می‌آید، حتی اگر ثابت باشد: Madrid está en España.',
      },
      {
        heading_fa: 'وقتی معنی عوض می‌شود',
        body_fa: 'بعضی صفت‌ها با ser و estar معنی متفاوتی می‌دهند. es aburrido یعنی «او آدم کسل‌کننده‌ای است» ولی está aburrido یعنی «او حوصله‌اش سر رفته».',
        examples: [
          { en: 'El café es frío. (ذاتاً سرد سرو می‌شود)', fa: 'قهوه سرد است (نوعش).' },
          { en: 'El café está frío. (الان سرد شده)', fa: 'قهوه سرد شده است.' },
        ],
        tip_fa: 'رایج‌ترین اشتباه فارسی‌زبان‌ها: گفتن soy cansado به‌جای estoy cansado.',
      },
    ],
    vocabulary: [
      { word: 'cansado', meaning_fa: 'خسته', example_en: 'Estoy muy cansado hoy.', example_fa: 'امروز خیلی خسته‌ام.', part_of_speech: 'adjetivo' },
      { word: 'contento', meaning_fa: 'خوشحال', example_en: 'Está contenta con el resultado.', example_fa: 'از نتیجه راضی است.', part_of_speech: 'adjetivo' },
      { word: 'profesora', meaning_fa: 'معلم (مؤنث)', example_en: 'Mi madre es profesora.', example_fa: 'مادرم معلم است.', part_of_speech: 'sustantivo' },
      { word: 'ocupado', meaning_fa: 'مشغول', example_en: 'Estoy ocupado ahora.', example_fa: 'الان مشغولم.', part_of_speech: 'adjetivo' },
      { word: 'listo', meaning_fa: 'آماده / باهوش', example_en: 'Estoy listo para salir.', example_fa: 'آماده رفتنم.', part_of_speech: 'adjetivo' },
      { word: 'enfermo', meaning_fa: 'بیمار', example_en: 'Mi hermano está enfermo.', example_fa: 'برادرم مریض است.', part_of_speech: 'adjetivo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Yo ___ muy cansado hoy.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['soy', 'estoy', 'es', 'está'], correct_answer: 1, explanation_fa: 'خستگی حالتی موقت است، پس estar می‌گیرد.', error_tag: 'ser_estar' },
      { kind: 'mcq', prompt: 'Madrid ___ en España.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['está', 'es', 'son', 'están'], correct_answer: 0, explanation_fa: 'مکان همیشه با estar می‌آید.', error_tag: 'ser_estar' },
      { kind: 'mcq', prompt: 'Mi padre ___ médico.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['está', 'es', 'estoy', 'son'], correct_answer: 1, explanation_fa: 'شغل ویژگی ثابت است، پس ser می‌گیرد.', error_tag: 'ser_estar' },
      { kind: 'mcq', prompt: 'Nosotros ___ de Irán.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['estamos', 'están', 'somos', 'es'], correct_answer: 2, explanation_fa: 'ملیت و منشأ ثابت است: somos de Irán.', error_tag: 'ser_estar' },
      { kind: 'mcq', prompt: 'La sopa ___ fría, no la quiero.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['es', 'está', 'son', 'están'], correct_answer: 1, explanation_fa: 'سوپ الان سرد شده — حالت گذرا، پس está.', error_tag: 'ser_estar' },
      { kind: 'mcq', prompt: '¿Dónde ___ vosotros?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['sois', 'estáis', 'somos', 'están'], correct_answer: 1, explanation_fa: 'پرسش از مکان با estar می‌آید.', error_tag: 'ser_estar' },
    ],
  },

  gender_agreement: {
    title: 'El género de los sustantivos',
    title_fa: 'جنسیت اسم‌ها',
    summary_fa: 'هر اسم اسپانیایی مذکر یا مؤنث است — مفهومی که در فارسی وجود ندارد.',
    sections: [
      {
        heading_fa: 'قاعده پایه',
        body_fa: 'بیشتر اسم‌هایی که به «o» ختم می‌شوند مذکرند (el libro) و بیشتر آن‌هایی که به «a» ختم می‌شوند مؤنث (la casa). حرف تعریف و صفت هم باید با جنسیت اسم هماهنگ شوند.',
        examples: [
          { en: 'el libro rojo', fa: 'کتاب قرمز' },
          { en: 'la casa roja', fa: 'خانه قرمز' },
        ],
        tip_fa: 'هر کلمه جدید را همیشه با حرف تعریفش حفظ کنید، نه تنها.',
      },
      {
        heading_fa: 'استثناهای مهم',
        body_fa: 'بعضی اسم‌ها با اینکه به a ختم می‌شوند مذکرند: el problema، el día، el mapa، el idioma. و بعضی با ختم به o مؤنثند: la mano، la foto.',
        examples: [
          { en: 'el problema difícil', fa: 'مسئله دشوار' },
          { en: 'la mano izquierda', fa: 'دست چپ' },
        ],
        tip_fa: 'این استثناها کم‌شمارند؛ همان اول یک‌بار حفظشان کنید.',
      },
      {
        heading_fa: 'تطابق جمع',
        body_fa: 'در جمع، هم حرف تعریف و هم صفت جمع می‌شوند: las casas blancas، los libros rojos.',
        examples: [
          { en: 'las mesas grandes', fa: 'میزهای بزرگ' },
          { en: 'los coches nuevos', fa: 'ماشین‌های نو' },
        ],
        tip_fa: 'اگر گروهی مذکر و مؤنث با هم باشند، شکل مذکر جمع به‌کار می‌رود.',
      },
    ],
    vocabulary: [
      { word: 'la mesa', meaning_fa: 'میز', example_en: 'La mesa es grande.', example_fa: 'میز بزرگ است.', part_of_speech: 'sustantivo' },
      { word: 'el libro', meaning_fa: 'کتاب', example_en: 'El libro es interesante.', example_fa: 'کتاب جالب است.', part_of_speech: 'sustantivo' },
      { word: 'el problema', meaning_fa: 'مسئله', example_en: 'Es un problema serio.', example_fa: 'مسئله جدی است.', part_of_speech: 'sustantivo' },
      { word: 'la mano', meaning_fa: 'دست', example_en: 'Levanta la mano.', example_fa: 'دستت را بلند کن.', part_of_speech: 'sustantivo' },
      { word: 'la ciudad', meaning_fa: 'شهر', example_en: 'La ciudad es antigua.', example_fa: 'شهر قدیمی است.', part_of_speech: 'sustantivo' },
      { word: 'el día', meaning_fa: 'روز', example_en: 'Es un día bonito.', example_fa: 'روز قشنگی است.', part_of_speech: 'sustantivo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: '___ problema es difícil.', prompt_fa: 'حرف تعریف درست را انتخاب کنید.', options: ['La', 'El', 'Los', 'Las'], correct_answer: 1, explanation_fa: 'problema با ختم به a مذکر است: el problema.', error_tag: 'gender_agreement' },
      { kind: 'mcq', prompt: 'Las casas son ___.', prompt_fa: 'تطابق صفت را رعایت کنید.', options: ['blanco', 'blanca', 'blancos', 'blancas'], correct_answer: 3, explanation_fa: 'casas مؤنث جمع است، پس blancas.', error_tag: 'gender_agreement' },
      { kind: 'mcq', prompt: '___ mano derecha.', prompt_fa: 'حرف تعریف درست را انتخاب کنید.', options: ['El', 'La', 'Los', 'Un'], correct_answer: 1, explanation_fa: 'mano با ختم به o مؤنث است: la mano.', error_tag: 'gender_agreement' },
      { kind: 'mcq', prompt: 'Los coches ___.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['nuevas', 'nueva', 'nuevos', 'nuevo'], correct_answer: 2, explanation_fa: 'coches مذکر جمع است، پس nuevos.', error_tag: 'gender_agreement' },
      { kind: 'mcq', prompt: '___ ciudad es muy antigua.', prompt_fa: 'حرف تعریف درست را انتخاب کنید.', options: ['El', 'Los', 'La', 'Un'], correct_answer: 2, explanation_fa: 'ciudad مؤنث است: la ciudad.', error_tag: 'gender_agreement' },
      { kind: 'mcq', prompt: 'Es ___ día bonito.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['una', 'un', 'la', 'unas'], correct_answer: 1, explanation_fa: 'día مذکر است: un día.', error_tag: 'gender_agreement' },
    ],
  },

  present_conjugation: {
    title: 'El presente de indicativo',
    title_fa: 'صرف زمان حال',
    summary_fa: 'سه گروه فعل -ar، -er و -ir و شش شکل صرف آن‌ها.',
    sections: [
      {
        heading_fa: 'سه گروه فعل',
        body_fa: 'همه افعال اسپانیایی به -ar، -er یا -ir ختم می‌شوند. برای صرف، این پایان را برمی‌داریم و پایانه مخصوص هر شخص را اضافه می‌کنیم.',
        examples: [
          { en: 'hablar → hablo, hablas, habla', fa: 'حرف زدن → حرف می‌زنم، می‌زنی، می‌زند' },
          { en: 'comer → como, comes, come', fa: 'خوردن → می‌خورم، می‌خوری، می‌خورد' },
        ],
        tip_fa: 'برخلاف فارسی، ضمیر فاعلی معمولاً حذف می‌شود چون خودِ فعل شخص را نشان می‌دهد.',
      },
      {
        heading_fa: 'پایانه‌ها',
        body_fa: '-ar: o, as, a, amos, áis, an — -er: o, es, e, emos, éis, en — -ir: o, es, e, imos, ís, en. تنها تفاوت -er و -ir در اول‌شخص جمع است.',
        examples: [
          { en: 'Nosotros hablamos español.', fa: 'ما اسپانیایی حرف می‌زنیم.' },
          { en: 'Vosotros vivís en Madrid.', fa: 'شما در مادرید زندگی می‌کنید.' },
        ],
        tip_fa: 'در آمریکای لاتین vosotros به‌کار نمی‌رود و به‌جایش ustedes می‌آید.',
      },
      {
        heading_fa: 'افعال بی‌قاعده پرکاربرد',
        body_fa: 'ser، ir، tener، hacer و estar بی‌قاعده‌اند و چون بسیار پرکاربردند باید زودتر از بقیه حفظ شوند.',
        examples: [
          { en: 'Tengo dos hermanos.', fa: 'دو برادر دارم.' },
          { en: 'Voy al trabajo.', fa: 'به سر کار می‌روم.' },
        ],
        tip_fa: 'روزی یک فعل بی‌قاعده با شش شکلش تمرین کنید.',
      },
    ],
    vocabulary: [
      { word: 'hablar', meaning_fa: 'حرف زدن', example_en: 'Hablo español.', example_fa: 'اسپانیایی حرف می‌زنم.', part_of_speech: 'verbo' },
      { word: 'comer', meaning_fa: 'خوردن', example_en: 'Comemos a las dos.', example_fa: 'ساعت دو غذا می‌خوریم.', part_of_speech: 'verbo' },
      { word: 'vivir', meaning_fa: 'زندگی کردن', example_en: 'Vivo en Teherán.', example_fa: 'در تهران زندگی می‌کنم.', part_of_speech: 'verbo' },
      { word: 'tener', meaning_fa: 'داشتن', example_en: 'Tengo un coche.', example_fa: 'یک ماشین دارم.', part_of_speech: 'verbo' },
      { word: 'hacer', meaning_fa: 'انجام دادن', example_en: '¿Qué haces?', example_fa: 'چه کار می‌کنی؟', part_of_speech: 'verbo' },
      { word: 'ir', meaning_fa: 'رفتن', example_en: 'Voy a casa.', example_fa: 'به خانه می‌روم.', part_of_speech: 'verbo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Nosotros ___ en Madrid.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['vive', 'vives', 'vivimos', 'viven'], correct_answer: 2, explanation_fa: 'با nosotros فعل vivir می‌شود vivimos.', error_tag: 'present_conjugation' },
      { kind: 'mcq', prompt: 'Yo ___ español todos los días.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['hablo', 'hablas', 'habla', 'hablan'], correct_answer: 0, explanation_fa: 'با yo پایانه o می‌آید: hablo.', error_tag: 'present_conjugation' },
      { kind: 'mcq', prompt: 'Ella ___ dos hermanos.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['tengo', 'tienes', 'tiene', 'tenemos'], correct_answer: 2, explanation_fa: 'tener با ella می‌شود tiene.', error_tag: 'present_conjugation' },
      { kind: 'mcq', prompt: '¿Qué ___ tú los domingos?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['hago', 'haces', 'hace', 'hacen'], correct_answer: 1, explanation_fa: 'hacer با tú می‌شود haces.', error_tag: 'present_conjugation' },
      { kind: 'mcq', prompt: 'Ellos ___ mucho café.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['bebo', 'bebes', 'bebemos', 'beben'], correct_answer: 3, explanation_fa: 'با ellos پایانه en می‌آید: beben.', error_tag: 'present_conjugation' },
      { kind: 'mcq', prompt: 'Yo ___ al gimnasio.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['voy', 'vas', 'va', 'vamos'], correct_answer: 0, explanation_fa: 'ir با yo می‌شود voy.', error_tag: 'present_conjugation' },
    ],
  },
};

/** Map an error tag onto the best Spanish lesson template. */
export function templateForTagEs(tag: string): string | undefined {
  if (ES_LESSON_TEMPLATES[tag]) return tag;
  const map: Record<string, string> = {
    ser_conjugation: 'ser_estar',
    tener_age: 'ser_estar',
    plural_agreement: 'gender_agreement',
    preterite: 'present_conjugation',
    imperfect_vs_preterite: 'present_conjugation',
    subjunctive_present: 'present_conjugation',
  };
  return map[tag];
}

/** Default Spanish practice topic for a level. */
export function defaultTopicEs(level: CefrLevel): string {
  if (level === 'A1') return 'present_conjugation';
  if (level === 'A2') return 'gender_agreement';
  return 'ser_estar';
}
