// ============================================================
// زبان‌یار | Spanish pronunciation practice sentences
//
// Chosen around the sounds a Persian speaker finds hardest in
// Castilian Spanish:
//   * rolled «rr» vs single «r» (Persian has a tap, not a trill)
//   * «j» / «g+e,i» as /x/ — close to Persian «خ», so a good anchor
//   * «c/z» before e,i as /θ/ (ceceo) — absent in Persian
//   * «ñ» as /ɲ/
//   * «b/v» sharing one sound — Persian keeps them distinct
//   * vowels staying pure and short (no diphthongisation)
// ============================================================

import type { CefrLevel } from '@/types/db';
import type { TargetSentence } from './pronunciation-engine';

export const SENTENCE_BANK_ES: TargetSentence[] = [
  // ---------------- A1 ----------------
  { id: 'es-a1-1', text: 'Buenos días. ¿Cómo estás?', translation_fa: 'صبح بخیر. حالت چطور است؟', level: 'A1', focus_fa: 'احوال‌پرسی و صدای «d» نرم' },
  { id: 'es-a1-2', text: 'Me llamo Sara y soy estudiante.', translation_fa: 'اسم من سارا است و دانشجو هستم.', level: 'A1', focus_fa: 'صدای «ll» و معرفی خود' },
  { id: 'es-a1-3', text: 'Tengo tres libros y dos bolígrafos.', translation_fa: 'سه کتاب و دو خودکار دارم.', level: 'A1', focus_fa: 'اعداد و «g» نرم' },
  { id: 'es-a1-4', text: 'La casa es muy grande y bonita.', translation_fa: 'خانه خیلی بزرگ و زیباست.', level: 'A1', focus_fa: 'مصوت‌های کوتاه و خالص' },
  { id: 'es-a1-5', text: 'Mi familia vive en España.', translation_fa: 'خانواده‌ام در اسپانیا زندگی می‌کند.', level: 'A1', focus_fa: 'صدای «ñ» و «v» شبیه «b»' },

  // ---------------- A2 ----------------
  { id: 'es-a2-1', text: 'El perro corre rápido por el parque.', translation_fa: 'سگ سریع در پارک می‌دود.', level: 'A2', focus_fa: '«rr» غلتان — سخت‌ترین صدا برای فارسی‌زبان' },
  { id: 'es-a2-2', text: 'Quiero un café con leche, por favor.', translation_fa: 'یک قهوه با شیر می‌خواهم، لطفاً.', level: 'A2', focus_fa: 'سفارش دادن و صدای «qu» = /k/' },
  { id: 'es-a2-3', text: 'Ayer fui al mercado con mi hermana.', translation_fa: 'دیروز با خواهرم به بازار رفتم.', level: 'A2', focus_fa: 'گذشته و «h» همیشه بی‌صدا' },
  { id: 'es-a2-4', text: 'La cena está lista en la cocina.', translation_fa: 'شام در آشپزخانه آماده است.', level: 'A2', focus_fa: '«c» پیش از e با صدای /θ/' },
  { id: 'es-a2-5', text: 'Hoy hace mucho calor en la ciudad.', translation_fa: 'امروز در شهر خیلی گرم است.', level: 'A2', focus_fa: 'ترکیب «ci» و «h» بی‌صدا' },

  // ---------------- B1 ----------------
  { id: 'es-b1-1', text: 'Llevo tres años estudiando español.', translation_fa: 'سه سال است که اسپانیایی می‌خوانم.', level: 'B1', focus_fa: 'ساختار مدت‌زمان و «ñ»' },
  { id: 'es-b1-2', text: 'El jueves viajaré a Guadalajara.', translation_fa: 'پنجشنبه به گوادالاخارا سفر می‌کنم.', level: 'B1', focus_fa: 'صدای «j» شبیه «خ» فارسی' },
  { id: 'es-b1-3', text: 'Necesito reservar una habitación doble.', translation_fa: 'باید یک اتاق دونفره رزرو کنم.', level: 'B1', focus_fa: 'واژگان سفر و «b/v» یکسان' },
  { id: 'es-b1-4', text: 'Prefiero el pescado a la carne roja.', translation_fa: 'ماهی را به گوشت قرمز ترجیح می‌دهم.', level: 'B1', focus_fa: 'ترجیح دادن و «r» ساده' },
  { id: 'es-b1-5', text: 'Aunque llueva, iremos a la montaña.', translation_fa: 'حتی اگر باران ببارد، به کوه می‌رویم.', level: 'B1', focus_fa: 'التزامی و «ll» + «ñ»' },

  // ---------------- B2 ----------------
  { id: 'es-b2-1', text: 'Espero que consigas el trabajo que quieres.', translation_fa: 'امیدوارم شغلی را که می‌خواهی به دست بیاوری.', level: 'B2', focus_fa: 'وجه التزامی و «g» پیش از u' },
  { id: 'es-b2-2', text: 'El desarrollo tecnológico avanza rápidamente.', translation_fa: 'توسعه فناوری به‌سرعت پیش می‌رود.', level: 'B2', focus_fa: 'کلمات بلند و «rr» میانی' },
  { id: 'es-b2-3', text: 'Si tuviera más tiempo, aprendería a tocar la guitarra.', translation_fa: 'اگر وقت بیشتری داشتم، گیتار زدن یاد می‌گرفتم.', level: 'B2', focus_fa: 'شرطی نوع دوم و آهنگ جمله' },
  { id: 'es-b2-4', text: 'La reunión se canceló a causa de la tormenta.', translation_fa: 'جلسه به‌خاطر طوفان لغو شد.', level: 'B2', focus_fa: 'ساختار «se» و «z» با /θ/' },

  // ---------------- C1 ----------------
  { id: 'es-c1-1', text: 'De haberlo sabido, habría tomado otra decisión.', translation_fa: 'اگر می‌دانستم، تصمیم دیگری می‌گرفتم.', level: 'C1', focus_fa: 'ساختار ادبی و پیوستگی کلمات' },
  { id: 'es-c1-2', text: 'El escritor argentino recibió un reconocimiento internacional.', translation_fa: 'نویسنده آرژانتینی تقدیر بین‌المللی دریافت کرد.', level: 'C1', focus_fa: 'جمله بلند و حفظ ریتم' },
  { id: 'es-c1-3', text: 'Por muy difícil que parezca, merece la pena intentarlo.', translation_fa: 'هرچقدر هم سخت به‌نظر برسد، ارزش تلاش دارد.', level: 'C1', focus_fa: 'التزامی امتیازی و «j» در dificil/merece' },

  // ---------------- C2 ----------------
  { id: 'es-c2-1', text: 'Su discurso, lejos de apaciguar los ánimos, los caldeó aún más.', translation_fa: 'سخنرانی‌اش به‌جای آرام کردن فضا، آن را ملتهب‌تر کرد.', level: 'C2', focus_fa: 'جمله معترضه و آهنگ پیچیده' },
  { id: 'es-c2-2', text: 'Cabe señalar la elevada incidencia del fenómeno en zonas rurales.', translation_fa: 'باید به شیوع بالای این پدیده در مناطق روستایی اشاره کرد.', level: 'C2', focus_fa: 'لحن آکادمیک و «c/z» متعدد' },
];

/**
 * Spanish-specific pronunciation hints. Mirrors the shape used by the
 * English engine so the same feedback UI renders both.
 */
export const PHONEME_HINTS_ES: { test: RegExp; note_fa: string }[] = [
  { test: /rr|^r/i, note_fa: '«rr» باید غلتان و کشیده باشد. نوک زبان چند بار پشت دندان بالا بلرزد — با «ر» تکی فارسی فرق دارد.' },
  { test: /[jg][ei]|j/i, note_fa: 'صدای «j» و «g» پیش از e/i مثل «خ» فارسی است، نه «ج».' },
  { test: /[cz][eiaou]|z/i, note_fa: 'در اسپانیایی اروپا، «z» و «c» پیش از e/i مثل th انگلیسی در think تلفظ می‌شود، نه «س».' },
  { test: /ñ/i, note_fa: '«ñ» صدای «نی» می‌دهد، مثل «نیّت» — یک صدای واحد است نه دو صدا.' },
  { test: /ll|y/i, note_fa: '«ll» در اسپانیای امروز بیشتر مثل «ی» تلفظ می‌شود.' },
  { test: /\bh/i, note_fa: 'حرف «h» در اسپانیایی همیشه بی‌صداست: hola خوانده می‌شود «اولا».' },
  { test: /[bv]/i, note_fa: '«b» و «v» در اسپانیایی یک صدا دارند؛ «v» را مثل «و» فارسی تلفظ نکنید.' },
];

/** Level-filtered practice set, same contract as the English bank. */
export function sentencesForLevelEs(level: CefrLevel | null): TargetSentence[] {
  if (!level) return SENTENCE_BANK_ES.filter((s) => s.level === 'A1' || s.level === 'A2');
  const pool = SENTENCE_BANK_ES.filter((s) => s.level === level);
  return pool.length ? pool : SENTENCE_BANK_ES.slice(0, 5);
}
