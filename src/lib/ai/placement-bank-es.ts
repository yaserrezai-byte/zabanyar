// ============================================================
// زبان‌یار | Spanish placement bank — 38 calibrated items, A1 → C2
//
// Written for Persian speakers. The pedagogy is deliberately NOT a
// translation of the English bank: it targets the things that actually
// trip up a Persian speaker learning Spanish —
//   * grammatical gender (Persian has none at all)
//   * ser vs estar (Persian has a single «بودن»)
//   * heavy verb conjugation (6 persons vs Persian's simpler set)
//   * the subjunctive (no direct Persian equivalent)
//   * por vs para
//   * gustar-type inverted constructions
//
// Answer positions are intentionally varied here, and are shuffled
// again at serve time by pickNextQuestionEs().
// ============================================================

import type { PlacementQuestion } from '@/types/db';
import { shuffleQuestion } from './shuffle';

export const PLACEMENT_BANK_ES: PlacementQuestion[] = [
  // ---------------- A1 ----------------
  { id: 'es-a1-g1', skill: 'grammar', level: 'A1', prompt: 'Yo ___ estudiante.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['eres', 'soy', 'es', 'somos'], correct_index: 1, explanation_fa: 'با «yo» فعل ser به‌صورت soy صرف می‌شود.', error_tag: 'ser_conjugation' },
  { id: 'es-a1-g2', skill: 'grammar', level: 'A1', prompt: '___ mesa es grande.', prompt_fa: 'حرف تعریف درست را انتخاب کنید.', options: ['El', 'La', 'Los', 'Un'], correct_index: 1, explanation_fa: 'mesa مؤنث است، پس حرف تعریف la می‌گیرد. در فارسی جنسیت دستوری نداریم و باید جنسیت هر اسم را با خودش حفظ کرد.', error_tag: 'gender_agreement' },
  { id: 'es-a1-g3', skill: 'grammar', level: 'A1', prompt: 'Nosotros ___ en Madrid.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['vivimos', 'vives', 'vive', 'viven'], correct_index: 0, explanation_fa: 'فعل vivir با nosotros می‌شود vivimos.', error_tag: 'present_conjugation' },
  { id: 'es-a1-v1', skill: 'vocabulary', level: 'A1', prompt: 'El contrario de «grande» es ___.', prompt_fa: 'متضاد را انتخاب کنید.', options: ['alto', 'largo', 'pequeño', 'ancho'], correct_index: 2, explanation_fa: 'متضاد grande کلمه pequeño است.', error_tag: 'antonyms' },
  { id: 'es-a1-v2', skill: 'vocabulary', level: 'A1', prompt: 'Desayunamos por la ___.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['noche', 'tarde', 'mañana', 'madrugada'], correct_index: 2, explanation_fa: 'صبحانه por la mañana خورده می‌شود.', error_tag: 'daily_words' },
  { id: 'es-a1-v3', skill: 'vocabulary', level: 'A1', prompt: '«Gracias» — la respuesta típica es ___.', prompt_fa: 'پاسخ رایج را انتخاب کنید.', options: ['De nada', 'Por favor', 'Lo siento', 'Hasta luego'], correct_index: 0, explanation_fa: 'پاسخ رایج به تشکر De nada است.', error_tag: 'functional_language' },
  { id: 'es-a1-r1', skill: 'reading', level: 'A1', prompt: 'Lee: «Ana tiene un coche rojo. Es muy rápido.» ¿De qué color es el coche?', prompt_fa: 'بر اساس متن پاسخ دهید.', options: ['Azul', 'Rojo', 'Verde', 'Negro'], correct_index: 1, explanation_fa: 'در متن آمده coche rojo یعنی ماشین قرمز.', error_tag: 'detail_reading' },

  // ---------------- A2 ----------------
  { id: 'es-a2-g1', skill: 'grammar', level: 'A2', prompt: 'Ayer ___ al cine con mis amigos.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['voy', 'iba', 'fui', 'iré'], correct_index: 2, explanation_fa: 'ayer نشانه گذشته کامل است؛ pretérito indefinido فعل ir می‌شود fui.', error_tag: 'preterite' },
  { id: 'es-a2-g2', skill: 'grammar', level: 'A2', prompt: 'María ___ cansada hoy.', prompt_fa: 'ser یا estar؟', options: ['es', 'está', 'son', 'están'], correct_index: 1, explanation_fa: 'حالت موقت با estar می‌آید. «خسته بودن» وضعیتی گذرا است، پس está. این تفاوت در فارسی وجود ندارد چون هر دو «است» می‌شوند.', error_tag: 'ser_estar' },
  { id: 'es-a2-g3', skill: 'grammar', level: 'A2', prompt: 'Las casas ___ blancas.', prompt_fa: 'تطابق را رعایت کنید.', options: ['es', 'son', 'está', 'somos'], correct_index: 1, explanation_fa: 'فاعل جمع است، پس son. صفت هم با blancas جمع و مؤنث شده است.', error_tag: 'plural_agreement' },
  { id: 'es-a2-g4', skill: 'grammar', level: 'A2', prompt: 'A mí ___ gusta el fútbol.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['me', 'yo', 'mi', 'te'], correct_index: 0, explanation_fa: 'ساختار gustar وارونه است: چیزی «برای من» خوشایند است، پس ضمیر me می‌آید نه yo.', error_tag: 'gustar_structure' },
  { id: 'es-a2-g5', skill: 'grammar', level: 'A2', prompt: 'Este libro es ___ interesante que el otro.', prompt_fa: 'مقایسه را کامل کنید.', options: ['tan', 'más', 'muy', 'mucho'], correct_index: 1, explanation_fa: 'برای برتری از más ... que استفاده می‌شود.', error_tag: 'comparatives' },
  { id: 'es-a2-v1', skill: 'vocabulary', level: 'A2', prompt: 'Voy a ___ una decisión.', prompt_fa: 'فعل مناسب را انتخاب کنید.', options: ['hacer', 'tomar', 'dar', 'poner'], correct_index: 1, explanation_fa: 'ترکیب درست tomar una decisión است.', error_tag: 'collocations' },
  { id: 'es-a2-l1', skill: 'listening', level: 'A2', prompt: '¿Qué palabra tiene un sonido diferente?', prompt_fa: 'کدام کلمه صدای متفاوتی دارد؟', options: ['casa', 'cielo', 'cama', 'cosa'], correct_index: 1, explanation_fa: 'در cielo حرف c پیش از e صدای /θ/ (کاستیلی) می‌دهد، اما در بقیه صدای /k/ دارد.', error_tag: 'c_pronunciation' },
  { id: 'es-a2-r1', skill: 'reading', level: 'A2', prompt: 'Lee: «La tienda abre a las 9 y cierra a las 6, excepto el domingo.» ¿Cuándo está cerrada?', prompt_fa: 'بر اساس متن پاسخ دهید.', options: ['El lunes', 'El sábado', 'El viernes', 'El domingo'], correct_index: 3, explanation_fa: 'excepto یعنی به‌جز؛ پس یکشنبه تعطیل است.', error_tag: 'inference' },

  // ---------------- B1 ----------------
  { id: 'es-b1-g1', skill: 'grammar', level: 'B1', prompt: 'Cuando era niño, ___ mucho al parque.', prompt_fa: 'زمان مناسب را انتخاب کنید.', options: ['fui', 'iba', 'iré', 'he ido'], correct_index: 1, explanation_fa: 'عادت تکرارشونده در گذشته با pretérito imperfecto می‌آید: iba.', error_tag: 'imperfect_vs_preterite' },
  { id: 'es-b1-g2', skill: 'grammar', level: 'B1', prompt: 'Si ___ tiempo, iré contigo.', prompt_fa: 'شرطی نوع اول.', options: ['tengo', 'tuviera', 'tendré', 'tenga'], correct_index: 0, explanation_fa: 'در شرطی واقعی، بعد از si زمان حال ساده می‌آید.', error_tag: 'conditional_1' },
  { id: 'es-b1-g3', skill: 'grammar', level: 'B1', prompt: 'Este regalo es ___ ti.', prompt_fa: 'por یا para؟', options: ['por', 'para', 'de', 'a'], correct_index: 1, explanation_fa: 'para برای گیرنده و مقصد به‌کار می‌رود؛ por بیشتر برای دلیل و علت است.', error_tag: 'por_para' },
  { id: 'es-b1-g4', skill: 'grammar', level: 'B1', prompt: 'Ya ___ la película dos veces.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['veo', 'vi', 'he visto', 'veía'], correct_index: 2, explanation_fa: 'با ya و تجربه‌ای که تا اکنون ادامه دارد، pretérito perfecto می‌آید.', error_tag: 'present_perfect' },
  { id: 'es-b1-g5', skill: 'grammar', level: 'B1', prompt: 'La carta ___ escrita por Juan.', prompt_fa: 'ساختار مجهول.', options: ['fue', 'hizo', 'tuvo', 'estuvo'], correct_index: 0, explanation_fa: 'مجهول با ser + اسم مفعول ساخته می‌شود: fue escrita.', error_tag: 'passive_voice' },
  { id: 'es-b1-v1', skill: 'vocabulary', level: 'B1', prompt: 'La reunión se ___ por la tormenta.', prompt_fa: 'فعل مناسب را انتخاب کنید.', options: ['canceló', 'cerró', 'apagó', 'quitó'], correct_index: 0, explanation_fa: 'cancelar یعنی لغو کردن.', error_tag: 'verb_choice' },
  { id: 'es-b1-v2', skill: 'vocabulary', level: 'B1', prompt: 'Estoy ___ en aprender japonés.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['interesante', 'interesado', 'interés', 'interesa'], correct_index: 1, explanation_fa: 'برای احساس شخص از interesado استفاده می‌شود؛ interesante یعنی «جالب» و صفت خود چیز است.', error_tag: 'ed_ing_adjectives' },
  { id: 'es-b1-w1', skill: 'writing', level: 'B1', prompt: 'Llovía; ___, salimos a pasear.', prompt_fa: 'کلمه ربط مناسب.', options: ['por eso', 'sin embargo', 'porque', 'así que'], correct_index: 1, explanation_fa: 'sin embargo برای بیان تضاد به‌کار می‌رود.', error_tag: 'linkers' },
  { id: 'es-b1-r1', skill: 'reading', level: 'B1', prompt: 'Lee: «Aunque el proyecto se retrasó, el equipo cumplió el plazo final.» ¿Qué pasó?', prompt_fa: 'بر اساس متن پاسخ دهید.', options: ['No lo cumplieron', 'Se canceló', 'Cumplieron el plazo', 'Terminó antes'], correct_index: 2, explanation_fa: 'با وجود تأخیر، مهلت نهایی رعایت شد.', error_tag: 'concession' },

  // ---------------- B2 ----------------
  { id: 'es-b2-g1', skill: 'grammar', level: 'B2', prompt: 'Espero que ___ pronto.', prompt_fa: 'وجه التزامی.', options: ['vienes', 'vengas', 'vendrás', 'veniste'], correct_index: 1, explanation_fa: 'بعد از esperar que وجه التزامی (subjuntivo) می‌آید: vengas. این وجه معادل مستقیم فارسی ندارد.', error_tag: 'subjunctive_present' },
  { id: 'es-b2-g2', skill: 'grammar', level: 'B2', prompt: 'Si ___ más dinero, viajaría por el mundo.', prompt_fa: 'شرطی غیرواقعی.', options: ['tengo', 'tenga', 'tuviera', 'tendría'], correct_index: 2, explanation_fa: 'شرطی نوع دوم: si + imperfecto de subjuntivo + condicional.', error_tag: 'conditional_2' },
  { id: 'es-b2-g3', skill: 'grammar', level: 'B2', prompt: 'No creo que ___ razón.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['tiene', 'tenga', 'tendrá', 'tuvo'], correct_index: 1, explanation_fa: 'با no creo que (شک و انکار) التزامی می‌آید.', error_tag: 'subjunctive_doubt' },
  { id: 'es-b2-g4', skill: 'grammar', level: 'B2', prompt: 'Llevo tres años ___ español.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['estudiar', 'estudiado', 'estudiando', 'estudio'], correct_index: 2, explanation_fa: 'ساختار llevar + gerundio برای مدت‌زمان ادامه‌دار به‌کار می‌رود.', error_tag: 'llevar_gerund' },
  { id: 'es-b2-v1', skill: 'vocabulary', level: 'B2', prompt: 'Se me ___ el nombre; no lo recuerdo.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['olvidó', 'perdí', 'dejé', 'fui'], correct_index: 0, explanation_fa: 'ساختار se me olvidó یعنی «فراموشم شد» — ساختاری وارونه و بسیار رایج.', error_tag: 'se_accidental' },
  { id: 'es-b2-w1', skill: 'writing', level: 'B2', prompt: '¿Cuál es más formal?', prompt_fa: 'رسمی‌ترین را انتخاب کنید.', options: ['Oye, mira', 'Le agradezco su atención', 'Vale, guay', 'Un abrazo'], correct_index: 1, explanation_fa: 'Le agradezco su atención عبارتی رسمی و اداری است.', error_tag: 'register' },
  { id: 'es-b2-l1', skill: 'listening', level: 'B2', prompt: '¿Qué palabra lleva tilde?', prompt_fa: 'کدام کلمه تشدید/تلفظ نشانه‌دار دارد؟', options: ['examen', 'facil', 'joven', 'lapiz'], correct_index: 3, explanation_fa: 'lápiz به تیلده نیاز دارد چون کلمه‌ای llana است که به z ختم می‌شود.', error_tag: 'accent_marks' },
  { id: 'es-b2-r1', skill: 'reading', level: 'B2', prompt: 'Lee: «El informe, pese a su extensión, carecía de datos concretos.» ¿Cuál era el problema?', prompt_fa: 'مشکل گزارش چه بود؟', options: ['Era muy corto', 'No tenía datos concretos', 'Tenía errores', 'Llegó tarde'], correct_index: 1, explanation_fa: 'carecer de یعنی فاقد بودن؛ گزارش داده مشخص نداشت.', error_tag: 'inference' },

  // ---------------- C1 ----------------
  { id: 'es-c1-g1', skill: 'grammar', level: 'C1', prompt: 'Si lo ___ sabido, habría actuado de otra manera.', prompt_fa: 'شرطی نوع سوم.', options: ['he', 'había', 'hubiera', 'habré'], correct_index: 2, explanation_fa: 'شرطی نوع سوم: si + hubiera + participio.', error_tag: 'conditional_3' },
  { id: 'es-c1-g2', skill: 'grammar', level: 'C1', prompt: 'Por mucho que ___, no lo conseguirá.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['insiste', 'insista', 'insistirá', 'insistió'], correct_index: 1, explanation_fa: 'por mucho que با التزامی می‌آید و مفهوم «هرچقدر هم که» می‌دهد.', error_tag: 'subjunctive_concession' },
  { id: 'es-c1-g3', skill: 'grammar', level: 'C1', prompt: 'Ojalá ___ venido a la fiesta.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['has', 'habías', 'hubieras', 'habrás'], correct_index: 2, explanation_fa: 'ojalá با آرزوی محقق‌نشده در گذشته، hubieras می‌گیرد.', error_tag: 'subjunctive_past' },
  { id: 'es-c1-v1', skill: 'vocabulary', level: 'C1', prompt: '«Echar una mano» significa ___.', prompt_fa: 'معنی اصطلاح.', options: ['pedir dinero', 'ayudar', 'despedirse', 'enfadarse'], correct_index: 1, explanation_fa: 'echar una mano یعنی کمک کردن — معادل «دست کسی را گرفتن».', error_tag: 'idioms' },
  { id: 'es-c1-w1', skill: 'writing', level: 'C1', prompt: 'Elige el conector de consecuencia:', prompt_fa: 'رابط نتیجه را انتخاب کنید.', options: ['no obstante', 'por consiguiente', 'asimismo', 'en cambio'], correct_index: 1, explanation_fa: 'por consiguiente یعنی «در نتیجه».', error_tag: 'linkers' },

  // ---------------- C2 ----------------
  { id: 'es-c2-g1', skill: 'grammar', level: 'C2', prompt: 'De ___ sabido la verdad, no habría firmado.', prompt_fa: 'ساختار پیشرفته شرطی.', options: ['haber', 'habiendo', 'había', 'hube'], correct_index: 0, explanation_fa: 'ساختار de + infinitivo compuesto جایگزین ادبی شرطی نوع سوم است.', error_tag: 'advanced_conditional' },
  { id: 'es-c2-v1', skill: 'vocabulary', level: 'C2', prompt: '«A regañadientes» quiere decir ___.', prompt_fa: 'معنی اصطلاح.', options: ['con entusiasmo', 'de mala gana', 'en secreto', 'sin pensar'], correct_index: 1, explanation_fa: 'a regañadientes یعنی با اکراه و بی‌میلی.', error_tag: 'idioms' },
  { id: 'es-c2-r1', skill: 'reading', level: 'C2', prompt: 'Lee: «Su discurso, lejos de apaciguar los ánimos, los caldeó aún más.» ¿Qué efecto tuvo?', prompt_fa: 'اثر سخنرانی چه بود؟', options: ['Calmó a todos', 'No tuvo efecto', 'Aumentó la tensión', 'Aburrió al público'], correct_index: 2, explanation_fa: 'lejos de یعنی «برخلاف»؛ caldear los ánimos یعنی تنش را بالا بردن.', error_tag: 'nuance' },
  { id: 'es-c2-w1', skill: 'writing', level: 'C2', prompt: 'Elige la formulación más precisa en registro académico:', prompt_fa: 'دقیق‌ترین شکل آکادمیک را انتخاب کنید.', options: ['Se ve que pasa mucho', 'Cabe señalar su elevada incidencia', 'Es un montón', 'Pasa un buen rato'], correct_index: 1, explanation_fa: 'cabe señalar عبارتی استاندارد در نوشتار آکادمیک است.', error_tag: 'register' },
];

/**
 * Adaptive selection for the Spanish bank.
 *
 * Identical strategy to the English one: start at A2, climb on a clean
 * streak, drop on a miss, and always shuffle options before serving.
 */
export function pickNextQuestionEs(
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
      const pool = PLACEMENT_BANK_ES.filter(
        (q) => q.level === order[idx] && !askedIds.includes(q.id)
      );
      if (pool.length) {
        return shuffleQuestion(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
  }
  return null;
}
