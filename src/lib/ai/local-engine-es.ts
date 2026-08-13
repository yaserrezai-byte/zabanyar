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
  preterite: {
    title: 'El pretérito indefinido',
    title_fa: 'گذشته ساده',
    summary_fa: 'بیان کارهای تمام‌شده در گذشته و تفاوتش با imperfecto.',
    sections: [
      {
        heading_fa: 'کاربرد',
        body_fa: 'pretérito indefinido برای کاری به‌کار می‌رود که در گذشته شروع و تمام شده است. معمولاً با ayer، anoche، la semana pasada و el año pasado می‌آید.',
        examples: [
          { en: 'Ayer comí en un restaurante.', fa: 'دیروز در رستوران غذا خوردم.' },
          { en: 'El año pasado viajamos a Perú.', fa: 'سال گذشته به پرو سفر کردیم.' },
        ],
        tip_fa: 'اگر زمان مشخصی در گذشته ذکر شده، indefinido بگیرید.',
      },
      {
        heading_fa: 'پایانه‌های باقاعده',
        body_fa: '-ar: é, aste, ó, amos, asteis, aron — -er/-ir: í, iste, ió, imos, isteis, ieron. دقت کنید تشدید روی اول‌شخص و سوم‌شخص مفرد می‌آید.',
        examples: [
          { en: 'Hablé con mi madre.', fa: 'با مادرم حرف زدم.' },
          { en: 'Ella escribió una carta.', fa: 'او نامه‌ای نوشت.' },
        ],
        tip_fa: 'بدون تشدید معنی عوض می‌شود: hablo (حرف می‌زنم) در برابر habló (حرف زد).',
      },
      {
        heading_fa: 'بی‌قاعده‌های پرکاربرد',
        body_fa: 'ser و ir در گذشته کاملاً یکسانند: fui, fuiste, fue… معنی از جمله فهمیده می‌شود. tener → tuve، hacer → hice، estar → estuve.',
        examples: [
          { en: 'Fui al cine. (رفتن)', fa: 'به سینما رفتم.' },
          { en: 'Fui estudiante. (بودن)', fa: 'دانشجو بودم.' },
        ],
        tip_fa: 'بی‌قاعده‌ها تشدید نمی‌گیرند: tuve نه tuvé.',
      },
    ],
    vocabulary: [
      { word: 'ayer', meaning_fa: 'دیروز', example_en: 'Ayer llamé a Ana.', example_fa: 'دیروز به آنا زنگ زدم.', part_of_speech: 'adverbio' },
      { word: 'viajar', meaning_fa: 'سفر کردن', example_en: 'Viajamos en tren.', example_fa: 'با قطار سفر کردیم.', part_of_speech: 'verbo' },
      { word: 'terminar', meaning_fa: 'تمام کردن', example_en: 'Terminé el libro.', example_fa: 'کتاب را تمام کردم.', part_of_speech: 'verbo' },
      { word: 'anoche', meaning_fa: 'دیشب', example_en: 'Anoche dormí bien.', example_fa: 'دیشب خوب خوابیدم.', part_of_speech: 'adverbio' },
      { word: 'ocurrir', meaning_fa: 'رخ دادن', example_en: '¿Qué ocurrió?', example_fa: 'چه اتفاقی افتاد؟', part_of_speech: 'verbo' },
      { word: 'decidir', meaning_fa: 'تصمیم گرفتن', example_en: 'Decidieron quedarse.', example_fa: 'تصمیم گرفتند بمانند.', part_of_speech: 'verbo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Ayer ___ en un restaurante.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['como', 'comí', 'comía', 'comeré'], correct_answer: 1, explanation_fa: 'ayer نشانه گذشته کامل است: comí.', error_tag: 'preterite' },
      { kind: 'mcq', prompt: 'Ella ___ una carta anoche.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['escribe', 'escribía', 'escribió', 'escribirá'], correct_answer: 2, explanation_fa: 'سوم‌شخص مفرد -ir در گذشته: escribió.', error_tag: 'preterite' },
      { kind: 'mcq', prompt: 'Nosotros ___ a Perú el año pasado.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['vamos', 'fuimos', 'íbamos', 'iremos'], correct_answer: 1, explanation_fa: 'گذشته ir می‌شود fuimos.', error_tag: 'preterite' },
      { kind: 'mcq', prompt: 'Yo ___ mucho trabajo ayer.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['tengo', 'tenía', 'tuve', 'tendré'], correct_answer: 2, explanation_fa: 'tener در گذشته ساده: tuve.', error_tag: 'preterite' },
      { kind: 'mcq', prompt: '¿Qué ___ tú el sábado?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['haces', 'hiciste', 'hacías', 'harás'], correct_answer: 1, explanation_fa: 'hacer با tú در گذشته: hiciste.', error_tag: 'preterite' },
      { kind: 'mcq', prompt: 'Ellos ___ la película anoche.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['ven', 'veían', 'verán', 'vieron'], correct_answer: 3, explanation_fa: 'سوم‌شخص جمع گذشته ver: vieron.', error_tag: 'preterite' },
    ],
  },

  subjunctive_present: {
    title: 'El presente de subjuntivo',
    title_fa: 'وجه التزامی حال',
    summary_fa: 'وجهی که در فارسی معادل مستقیم ندارد و برای آرزو، شک و احساس به‌کار می‌رود.',
    sections: [
      {
        heading_fa: 'التزامی چیست؟',
        body_fa: 'اخباری (indicativo) واقعیت را بیان می‌کند، اما التزامی (subjuntivo) آرزو، شک، احساس و امر غیرقطعی را. در فارسی گاهی با «که… بیاید» نزدیک می‌شویم ولی ساختار یکسان نیست.',
        examples: [
          { en: 'Sé que viene. (اخباری — مطمئنم)', fa: 'می‌دانم که می‌آید.' },
          { en: 'Espero que venga. (التزامی — آرزو)', fa: 'امیدوارم بیاید.' },
        ],
        tip_fa: 'التزامی تقریباً همیشه بعد از «que» در جمله وابسته می‌آید.',
      },
      {
        heading_fa: 'ساخت',
        body_fa: 'از اول‌شخص حال شروع کنید، «o» را بردارید و پایانه مخالف بگذارید: افعال -ar پایانه e می‌گیرند و افعال -er/-ir پایانه a. hablar → hable، comer → coma، vivir → viva.',
        examples: [
          { en: 'Quiero que hables más despacio.', fa: 'می‌خواهم آهسته‌تر حرف بزنی.' },
          { en: 'Es importante que comas bien.', fa: 'مهم است که خوب غذا بخوری.' },
        ],
        tip_fa: 'به آن «پایانه برعکس» بگویید؛ راحت‌تر یادتان می‌ماند.',
      },
      {
        heading_fa: 'کِی لازم است؟',
        body_fa: 'بعد از فعل‌های خواستن و آرزو (querer que، esperar que)، احساس (me alegra que)، شک و انکار (no creo que، dudo que) و عبارات غیرشخصی (es necesario que).',
        examples: [
          { en: 'No creo que sea verdad.', fa: 'فکر نمی‌کنم درست باشد.' },
          { en: 'Ojalá tengas suerte.', fa: 'ان‌شاءالله شانس بیاوری.' },
        ],
        tip_fa: 'اگر فاعل دو جمله یکی باشد، مصدر می‌آید نه التزامی: quiero salir نه quiero que salga.',
      },
    ],
    vocabulary: [
      { word: 'esperar', meaning_fa: 'امیدوار بودن', example_en: 'Espero que estés bien.', example_fa: 'امیدوارم حالت خوب باشد.', part_of_speech: 'verbo' },
      { word: 'dudar', meaning_fa: 'شک داشتن', example_en: 'Dudo que llegue a tiempo.', example_fa: 'شک دارم به‌موقع برسد.', part_of_speech: 'verbo' },
      { word: 'ojalá', meaning_fa: 'ان‌شاءالله / کاش', example_en: 'Ojalá llueva.', example_fa: 'کاش باران ببارد.', part_of_speech: 'interjección' },
      { word: 'alegrarse', meaning_fa: 'خوشحال شدن', example_en: 'Me alegro de que vengas.', example_fa: 'خوشحالم که می‌آیی.', part_of_speech: 'verbo' },
      { word: 'necesario', meaning_fa: 'لازم', example_en: 'Es necesario que estudies.', example_fa: 'لازم است درس بخوانی.', part_of_speech: 'adjetivo' },
      { word: 'quizás', meaning_fa: 'شاید', example_en: 'Quizás venga mañana.', example_fa: 'شاید فردا بیاید.', part_of_speech: 'adverbio' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Espero que ___ pronto.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['vienes', 'vengas', 'vendrás', 'viniste'], correct_answer: 1, explanation_fa: 'بعد از esperar que التزامی می‌آید: vengas.', error_tag: 'subjunctive_present' },
      { kind: 'mcq', prompt: 'No creo que ___ razón.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['tiene', 'tenga', 'tendrá', 'tuvo'], correct_answer: 1, explanation_fa: 'با انکار و شک التزامی می‌آید: tenga.', error_tag: 'subjunctive_doubt' },
      { kind: 'mcq', prompt: 'Es necesario que ___ más.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['estudias', 'estudiar', 'estudies', 'estudiabas'], correct_answer: 2, explanation_fa: 'عبارت غیرشخصی + que + التزامی: estudies.', error_tag: 'subjunctive_present' },
      { kind: 'mcq', prompt: 'Ojalá ___ buen tiempo mañana.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['hace', 'haga', 'hará', 'hizo'], correct_answer: 1, explanation_fa: 'ojalá همیشه التزامی می‌گیرد: haga.', error_tag: 'subjunctive_present' },
      { kind: 'mcq', prompt: 'Quiero que tú me ___ la verdad.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['dices', 'digas', 'dirás', 'dijiste'], correct_answer: 1, explanation_fa: 'querer que + التزامی: digas.', error_tag: 'subjunctive_present' },
      { kind: 'mcq', prompt: 'Me alegro de que ___ aquí.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['estás', 'estés', 'estarás', 'estuviste'], correct_answer: 1, explanation_fa: 'فعل احساس + que + التزامی: estés.', error_tag: 'subjunctive_present' },
    ],
  },

  por_para: {
    title: 'Por y Para',
    title_fa: 'تفاوت por و para',
    summary_fa: 'هر دو در فارسی «برای» ترجمه می‌شوند، اما کاربردشان کاملاً متفاوت است.',
    sections: [
      {
        heading_fa: 'para: مقصد و هدف',
        body_fa: 'para برای گیرنده، هدف نهایی، مقصد سفر و مهلت زمانی به‌کار می‌رود. به آن «رو به جلو» فکر کنید.',
        examples: [
          { en: 'Este regalo es para ti.', fa: 'این هدیه برای توست.' },
          { en: 'Estudio para aprender.', fa: 'درس می‌خوانم تا یاد بگیرم.' },
        ],
        tip_fa: 'اگر می‌شود «به‌منظورِ» گذاشت، para درست است.',
      },
      {
        heading_fa: 'por: علت و مسیر',
        body_fa: 'por برای دلیل، مدت‌زمان، عبور از مکان، مبادله و قیمت می‌آید. به آن «رو به عقب / علت» فکر کنید.',
        examples: [
          { en: 'Gracias por tu ayuda.', fa: 'ممنون بابت کمکت.' },
          { en: 'Caminamos por el parque.', fa: 'در پارک قدم زدیم.' },
        ],
        tip_fa: 'اگر می‌شود «به‌خاطرِ» گذاشت، por درست است.',
      },
      {
        heading_fa: 'مقایسه مستقیم',
        body_fa: 'یک جمله با هر دو معنی متفاوت می‌دهد. Lo hago por ti یعنی «به‌خاطر تو انجامش می‌دهم» ولی Lo hago para ti یعنی «برای تو (که به تو بدهم) انجامش می‌دهم».',
        examples: [
          { en: 'Salgo para Madrid. (مقصد)', fa: 'عازم مادرید هستم.' },
          { en: 'Paso por Madrid. (عبور)', fa: 'از مادرید رد می‌شوم.' },
        ],
        tip_fa: 'عبارت‌های ثابت را حفظ کنید: por favor، por eso، para siempre.',
      },
    ],
    vocabulary: [
      { word: 'regalo', meaning_fa: 'هدیه', example_en: 'Es un regalo para ella.', example_fa: 'هدیه‌ای برای اوست.', part_of_speech: 'sustantivo' },
      { word: 'ayuda', meaning_fa: 'کمک', example_en: 'Gracias por la ayuda.', example_fa: 'ممنون بابت کمک.', part_of_speech: 'sustantivo' },
      { word: 'motivo', meaning_fa: 'دلیل', example_en: 'Por ese motivo no vine.', example_fa: 'به آن دلیل نیامدم.', part_of_speech: 'sustantivo' },
      { word: 'siempre', meaning_fa: 'همیشه', example_en: 'Para siempre.', example_fa: 'برای همیشه.', part_of_speech: 'adverbio' },
      { word: 'cambiar', meaning_fa: 'عوض کردن', example_en: 'Lo cambié por otro.', example_fa: 'با یکی دیگر عوضش کردم.', part_of_speech: 'verbo' },
      { word: 'plazo', meaning_fa: 'مهلت', example_en: 'Es para el lunes.', example_fa: 'برای دوشنبه است.', part_of_speech: 'sustantivo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Este regalo es ___ ti.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['por', 'para', 'de', 'a'], correct_answer: 1, explanation_fa: 'گیرنده با para می‌آید.', error_tag: 'por_para' },
      { kind: 'mcq', prompt: 'Gracias ___ tu ayuda.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['para', 'por', 'de', 'en'], correct_answer: 1, explanation_fa: 'تشکر بابت دلیل، با por می‌آید.', error_tag: 'por_para' },
      { kind: 'mcq', prompt: 'Caminamos ___ el parque.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['por', 'para', 'a', 'con'], correct_answer: 0, explanation_fa: 'عبور از یک مکان با por بیان می‌شود.', error_tag: 'por_para' },
      { kind: 'mcq', prompt: 'Estudio ___ aprender español.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['por', 'para', 'de', 'en'], correct_answer: 1, explanation_fa: 'هدف با para می‌آید.', error_tag: 'por_para' },
      { kind: 'mcq', prompt: 'El informe es ___ el lunes.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['por', 'para', 'en', 'a'], correct_answer: 1, explanation_fa: 'مهلت زمانی با para می‌آید.', error_tag: 'por_para' },
      { kind: 'mcq', prompt: 'Lo compré ___ veinte euros.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['para', 'por', 'de', 'con'], correct_answer: 1, explanation_fa: 'قیمت و مبادله با por می‌آید.', error_tag: 'por_para' },
    ],
  },

  gustar_structure: {
    title: 'Verbos como gustar',
    title_fa: 'ساختار gustar',
    summary_fa: 'فعل‌هایی که وارونه‌اند: چیزی «برای من» خوشایند است.',
    sections: [
      {
        heading_fa: 'چرا وارونه است؟',
        body_fa: 'در فارسی می‌گوییم «من فوتبال را دوست دارم» و فاعل «من» است. در اسپانیایی جمله برعکس ساخته می‌شود: A mí me gusta el fútbol، یعنی «فوتبال برای من خوشایند است». فاعل واقعی «فوتبال» است.',
        examples: [
          { en: 'Me gusta el café.', fa: 'قهوه دوست دارم.' },
          { en: 'Te gustan los libros.', fa: 'کتاب‌ها را دوست داری.' },
        ],
        tip_fa: 'هرگز نگویید «yo gusto»؛ آن یعنی «من خوشایندم».',
      },
      {
        heading_fa: 'مفرد یا جمع؟',
        body_fa: 'فعل با «چیزِ خوشایند» مطابقت می‌کند نه با شخص. اگر آن چیز جمع باشد gustan می‌آید.',
        examples: [
          { en: 'Me gusta la película.', fa: 'فیلم را دوست دارم.' },
          { en: 'Me gustan las películas.', fa: 'فیلم‌ها را دوست دارم.' },
        ],
        tip_fa: 'اگر بعدش مصدر بیاید همیشه مفرد است: me gusta leer y escribir.',
      },
      {
        heading_fa: 'فعل‌های هم‌خانواده',
        body_fa: 'encantar (خیلی دوست داشتن)، interesar (جالب بودن)، molestar (آزار دادن)، doler (درد کردن) و faltar (کم بودن) همگی همین ساختار را دارند.',
        examples: [
          { en: 'Me duele la cabeza.', fa: 'سرم درد می‌کند.' },
          { en: 'Nos encanta viajar.', fa: 'عاشق سفر کردنیم.' },
        ],
        tip_fa: 'doler هم وارونه است: «سر برای من درد می‌کند».',
      },
    ],
    vocabulary: [
      { word: 'gustar', meaning_fa: 'خوشایند بودن', example_en: 'Me gusta el té.', example_fa: 'چای دوست دارم.', part_of_speech: 'verbo' },
      { word: 'encantar', meaning_fa: 'بسیار دوست داشتن', example_en: 'Me encanta la música.', example_fa: 'عاشق موسیقی‌ام.', part_of_speech: 'verbo' },
      { word: 'doler', meaning_fa: 'درد کردن', example_en: 'Me duelen los pies.', example_fa: 'پاهایم درد می‌کند.', part_of_speech: 'verbo' },
      { word: 'interesar', meaning_fa: 'جالب بودن', example_en: 'Me interesa la historia.', example_fa: 'تاریخ برایم جالب است.', part_of_speech: 'verbo' },
      { word: 'molestar', meaning_fa: 'آزار دادن', example_en: 'Me molesta el ruido.', example_fa: 'سروصدا آزارم می‌دهد.', part_of_speech: 'verbo' },
      { word: 'faltar', meaning_fa: 'کم بودن', example_en: 'Me falta tiempo.', example_fa: 'وقت کم دارم.', part_of_speech: 'verbo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'A mí ___ gusta el fútbol.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['yo', 'me', 'mi', 'te'], correct_answer: 1, explanation_fa: 'ضمیر مفعولی me می‌آید، نه yo.', error_tag: 'gustar_structure' },
      { kind: 'mcq', prompt: 'Me ___ las películas españolas.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['gusta', 'gustan', 'gusto', 'gustas'], correct_answer: 1, explanation_fa: 'películas جمع است، پس gustan.', error_tag: 'gustar_structure' },
      { kind: 'mcq', prompt: '¿___ gusta viajar?', prompt_fa: 'گزینه درست را انتخاب کنید (خطاب به tú).', options: ['Te', 'Tú', 'Ti', 'Tu'], correct_answer: 0, explanation_fa: 'برای tú ضمیر te می‌آید.', error_tag: 'gustar_structure' },
      { kind: 'mcq', prompt: 'Me ___ la cabeza.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['duelo', 'duele', 'duelen', 'dolor'], correct_answer: 1, explanation_fa: 'cabeza مفرد است: me duele.', error_tag: 'gustar_structure' },
      { kind: 'mcq', prompt: 'A nosotros ___ encanta bailar.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['me', 'te', 'nos', 'les'], correct_answer: 2, explanation_fa: 'برای nosotros ضمیر nos می‌آید.', error_tag: 'gustar_structure' },
      { kind: 'mcq', prompt: 'Me gusta ___ y escribir.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['leo', 'leer', 'leyendo', 'leído'], correct_answer: 1, explanation_fa: 'بعد از gustar مصدر می‌آید: leer.', error_tag: 'gustar_structure' },
    ],
  },

  daily_conversation_es: {
    title: 'Conversación diaria',
    title_fa: 'مکالمه روزمره',
    summary_fa: 'عبارت‌های ضروری برای احوال‌پرسی، سفارش دادن و معرفی خود.',
    sections: [
      {
        heading_fa: 'سلام و احوال‌پرسی',
        body_fa: 'در موقعیت دوستانه ¿Qué tal? و ¿Cómo estás? و در موقعیت رسمی ¿Cómo está usted? به‌کار می‌رود. اسپانیایی‌ها معمولاً گرم و پرانرژی سلام می‌کنند.',
        examples: [
          { en: '¡Hola! ¿Qué tal?', fa: 'سلام! چطوری؟' },
          { en: 'Buenos días, ¿cómo está usted?', fa: 'صبح بخیر، حال شما چطور است؟' },
        ],
        tip_fa: 'tú غیررسمی و usted رسمی است؛ با غریبه و آدم مسن‌تر usted بگویید.',
      },
      {
        heading_fa: 'معرفی خود',
        body_fa: 'برای گفتن نام از me llamo استفاده می‌شود که تحت‌اللفظی یعنی «خودم را صدا می‌زنم». ملیت با ser می‌آید.',
        examples: [
          { en: 'Me llamo Reza y soy de Irán.', fa: 'اسمم رضاست و اهل ایرانم.' },
          { en: 'Encantado de conocerte.', fa: 'از آشنایی‌ات خوشوقتم.' },
        ],
        tip_fa: 'مرد encantado و زن encantada می‌گوید.',
      },
      {
        heading_fa: 'در کافه و رستوران',
        body_fa: 'برای سفارش مؤدبانه از Quería یا Me pone استفاده کنید. صورتحساب را با La cuenta, por favor بخواهید.',
        examples: [
          { en: 'Quería un café con leche, por favor.', fa: 'یک قهوه با شیر می‌خواستم، لطفاً.' },
          { en: 'La cuenta, por favor.', fa: 'صورتحساب لطفاً.' },
        ],
        tip_fa: 'Quiero درست است ولی Quería مؤدبانه‌تر به‌نظر می‌رسد.',
      },
    ],
    vocabulary: [
      { word: 'hola', meaning_fa: 'سلام', example_en: '¡Hola! ¿Qué tal?', example_fa: 'سلام! چطوری؟', part_of_speech: 'interjección' },
      { word: 'gracias', meaning_fa: 'ممنون', example_en: 'Muchas gracias.', example_fa: 'خیلی ممنون.', part_of_speech: 'interjección' },
      { word: 'por favor', meaning_fa: 'لطفاً', example_en: 'Un café, por favor.', example_fa: 'یک قهوه لطفاً.', part_of_speech: 'expresión' },
      { word: 'perdón', meaning_fa: 'ببخشید', example_en: 'Perdón, ¿dónde está el baño?', example_fa: 'ببخشید، دستشویی کجاست؟', part_of_speech: 'interjección' },
      { word: 'cuenta', meaning_fa: 'صورتحساب', example_en: 'La cuenta, por favor.', example_fa: 'صورتحساب لطفاً.', part_of_speech: 'sustantivo' },
      { word: 'encantado', meaning_fa: 'خوشوقتم', example_en: 'Encantado de conocerte.', example_fa: 'از آشنایی خوشوقتم.', part_of_speech: 'adjetivo' },
    ],
    exercises: [
      { kind: 'mcq', prompt: '«Gracias» — ___', prompt_fa: 'پاسخ رایج را انتخاب کنید.', options: ['Por favor', 'De nada', 'Perdón', 'Adiós'], correct_answer: 1, explanation_fa: 'پاسخ رایج به تشکر De nada است.', error_tag: 'functional_language' },
      { kind: 'mcq', prompt: '___ Reza y soy de Irán.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['Me llamo', 'Mi nombre', 'Yo llamo', 'Se llama'], correct_answer: 0, explanation_fa: 'برای معرفی نام me llamo به‌کار می‌رود.', error_tag: 'functional_language' },
      { kind: 'mcq', prompt: 'La ___, por favor.', prompt_fa: 'در رستوران چه می‌خواهید؟', options: ['carta', 'cuenta', 'cuenta bancaria', 'cocina'], correct_answer: 1, explanation_fa: 'cuenta یعنی صورتحساب.', error_tag: 'functional_language' },
      { kind: 'mcq', prompt: '¿Cómo ___ usted?', prompt_fa: 'حالت رسمی احوال‌پرسی.', options: ['estás', 'está', 'estáis', 'estoy'], correct_answer: 1, explanation_fa: 'با usted فعل سوم‌شخص مفرد می‌آید: está.', error_tag: 'formal_register' },
      { kind: 'mcq', prompt: 'Quería un café ___ leche.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['de', 'con', 'por', 'en'], correct_answer: 1, explanation_fa: 'café con leche ترکیب ثابت است.', error_tag: 'collocations' },
      { kind: 'mcq', prompt: 'Perdón, ¿dónde ___ el baño?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['es', 'está', 'son', 'hay'], correct_answer: 1, explanation_fa: 'پرسش از مکان با estar می‌آید.', error_tag: 'ser_estar' },
    ],
  },

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

/** Which Spanish templates suit each skill. */
export const TOPIC_MAP_ES: Record<SkillKind, string[]> = {
  grammar: ['ser_estar', 'gender_agreement', 'present_conjugation', 'preterite',
            'subjunctive_present', 'por_para', 'gustar_structure'],
  vocabulary: ['daily_conversation_es', 'gender_agreement', 'gustar_structure', 'por_para'],
  listening: ['daily_conversation_es', 'present_conjugation', 'ser_estar'],
  speaking: ['daily_conversation_es', 'ser_estar', 'gustar_structure', 'preterite'],
  reading: ['preterite', 'subjunctive_present', 'por_para', 'gender_agreement'],
  writing: ['gender_agreement', 'preterite', 'subjunctive_present', 'por_para',
            'present_conjugation'],
};

export function allTemplateKeysEs(): string[] {
  return Object.keys(ES_LESSON_TEMPLATES);
}

/** Map an error tag onto the best Spanish lesson template. */
export function templateForTagEs(tag: string): string | undefined {
  if (ES_LESSON_TEMPLATES[tag]) return tag;
  const map: Record<string, string> = {
    ser_conjugation: 'ser_estar',
    tener_age: 'ser_estar',
    plural_agreement: 'gender_agreement',
    imperfect_vs_preterite: 'preterite',
    subjunctive_doubt: 'subjunctive_present',
    subjunctive_concession: 'subjunctive_present',
    subjunctive_past: 'subjunctive_present',
    conditional_1: 'subjunctive_present',
    conditional_2: 'subjunctive_present',
    conditional_3: 'subjunctive_present',
    se_accidental: 'gustar_structure',
    personal_a: 'gender_agreement',
    punctuation_es: 'daily_conversation_es',
    functional_language: 'daily_conversation_es',
    formal_register: 'daily_conversation_es',
    collocations: 'daily_conversation_es',
    double_negative_es: 'present_conjugation',
    accent_marks: 'preterite',
    llevar_gerund: 'present_conjugation',
  };
  return map[tag];
}

/** Default Spanish practice topic for a level. */
export function defaultTopicEs(level: CefrLevel): string {
  if (level === 'A1') return 'present_conjugation';
  if (level === 'A2') return 'gender_agreement';
  if (level === 'B1') return 'preterite';
  return 'subjunctive_present';
}

/**
 * Local Spanish lesson builder — mirrors localLesson() in the English
 * engine so generateLesson() can dispatch on language.
 */
export function localLessonEs(
  skill: SkillKind,
  level: CefrLevel,
  hintTag?: string,
  exclude: string[] = []
) {
  let key = hintTag ? templateForTagEs(hintTag) : undefined;

  if (!key) {
    const pool = TOPIC_MAP_ES[skill] ?? allTemplateKeysEs();
    const fresh = pool.filter((k) => !exclude.includes(k));
    const candidates = fresh.length ? fresh : pool;
    key = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const t = ES_LESSON_TEMPLATES[key] ?? ES_LESSON_TEMPLATES.ser_estar;
  return {
    ...t,
    est_minutes: 12,
    topic: key,
    level,
    skill,
    title_fa: `${t.title_fa} — سطح ${level}`,
  };
}


// ------------------------------------------------------------
// Local Spanish grading (mirrors localGrade in the English engine)
// ------------------------------------------------------------
export interface LocalGradeEs {
  score: number;
  is_correct: boolean;
  feedback_fa: string;
  strengths_fa: string[];
  improvements_fa: string[];
  corrected_text: string;
  errors: EsDetected[];
}

/** Grade a Spanish text with the deterministic rule set. */
export function localGradeEs(text: string, skill: SkillKind = 'writing'): LocalGradeEs {
  const original = (text ?? '').trim();
  const errors = detectErrorsEs(original);

  // Apply every fix we are confident about.
  let corrected = original;
  for (const e of errors) {
    if (e.right && e.right !== e.wrong) {
      corrected = corrected.replace(e.wrong, e.right);
    }
  }

  const words = original.split(/\s+/).filter(Boolean).length;
  const penalty = Math.min(60, errors.length * 12);
  const lengthBonus = words >= 30 ? 10 : words >= 15 ? 5 : 0;
  const score = Math.max(20, Math.min(100, 80 - penalty + lengthBonus));

  const strengths: string[] = [];
  if (words >= 25) strengths.push('متن با طول مناسب نوشته شده است.');
  if (!errors.some((e) => e.error_tag === 'gender_agreement'))
    strengths.push('تطابق جنسیت اسم و صفت درست رعایت شده است.');
  if (!errors.some((e) => e.error_tag === 'ser_estar'))
    strengths.push('کاربرد ser و estar درست بوده است.');
  if (/[¿¡]/.test(original))
    strengths.push('از علامت‌های باز اسپانیایی (¿ ¡) درست استفاده کرده‌اید.');
  if (!strengths.length) strengths.push('تلاش برای نوشتن به اسپانیایی ارزشمند است.');

  const improvements = errors.slice(0, 3).map((e) => e.note_fa);
  if (!improvements.length) {
    improvements.push('برای پیشرفت بیشتر، جمله‌های طولانی‌تر و زمان‌های متنوع‌تر تمرین کنید.');
  }

  return {
    score,
    is_correct: errors.length === 0,
    feedback_fa: errors.length
      ? `${errors.length} نکته قابل بهبود پیدا شد. مهم‌ترینشان: ${errors[0].note_fa}`
      : 'متن شما از نظر قواعدی که بررسی شد مشکلی نداشت. آفرین!',
    strengths_fa: strengths,
    improvements_fa: improvements,
    corrected_text: corrected,
    errors: errors.map((e) => ({ ...e, skill: e.skill ?? skill })),
  };
}


// ------------------------------------------------------------
// Local Spanish tutor replies
// ------------------------------------------------------------
const OPENERS_ES = [
  '¡Muy bien!',
  '¡Buen intento!',
  '¡Genial!',
  'Vale, te entiendo.',
  '¡Qué interesante!',
];
const OPENERS_ES_FA = [
  'خیلی خوب!',
  'تلاش خوبی بود!',
  'عالی!',
  'باشه، متوجه شدم.',
  'چقدر جالب!',
];

const FOLLOW_UPS_ES = [
  '¿Puedes contarme más sobre eso?',
  'Y tú, ¿qué opinas?',
  '¿Qué hiciste el fin de semana?',
  '¿Por qué piensas eso?',
  '¿Cómo es un día normal para ti?',
];
const FOLLOW_UPS_ES_FA = [
  'می‌توانی بیشتر درباره‌اش بگویی؟',
  'و تو، نظرت چیست؟',
  'آخر هفته چه کار کردی؟',
  'چرا این‌طور فکر می‌کنی؟',
  'یک روز عادی برای تو چطور است؟',
];

function hashEs(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface LocalReplyEs {
  reply: string;
  translation_fa: string;
  corrections: { wrong: string; right: string; note_fa: string; error_tag?: string }[];
  new_words: { word: string; meaning_fa: string; example_en?: string }[];
}

/** Deterministic Spanish tutor turn, used when no AI key is set. */
export function localReplyEs(
  userText: string,
  ctx: { interests?: string[] } = {}
): LocalReplyEs {
  const graded = localGradeEs(userText, 'speaking');
  const h = hashEs(userText);
  const opener = OPENERS_ES[h % OPENERS_ES.length];
  const openerFa = OPENERS_ES_FA[h % OPENERS_ES_FA.length];

  let follow = FOLLOW_UPS_ES[(h >>> 3) % FOLLOW_UPS_ES.length];
  let followFa = FOLLOW_UPS_ES_FA[(h >>> 3) % FOLLOW_UPS_ES_FA.length];

  if (ctx.interests?.length) {
    const topic = ctx.interests[h % ctx.interests.length];
    follow = `Por cierto, háblame de «${topic}». ¿Qué es lo que más te gusta?`;
    followFa = `راستی، درباره «${topic}» بگو — بیشتر از چه چیزش لذت می‌بری؟`;
  }

  return {
    reply: `${opener} ${follow}`,
    translation_fa: `${openerFa} ${followFa}`,
    corrections: graded.errors.map(({ wrong, right, note_fa, error_tag }) => ({
      wrong,
      right,
      note_fa,
      error_tag,
    })),
    new_words: [],
  };
}
