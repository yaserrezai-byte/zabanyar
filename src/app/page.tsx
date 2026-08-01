import Link from 'next/link';

const FEATURES = [
  {
    icon: '🎯',
    title: 'تعیین سطح تطبیقی',
    body: 'آزمونی که با هر پاسخ شما سخت‌تر یا ساده‌تر می‌شود و در ۱۴ سؤال سطح واقعی‌تان را از A1 تا C2 مشخص می‌کند.',
  },
  {
    icon: '🧠',
    title: 'مربی با حافظه',
    body: 'مربی هوشمند اشتباهات، کلمات دشوار و علاقه‌مندی‌های شما را به خاطر می‌سپارد و درس بعدی را بر همان اساس می‌سازد.',
  },
  {
    icon: '🔍',
    title: 'هوش تحلیل خطا',
    body: 'اگر همیشه در زمان گذشته اشتباه می‌کنید، سیستم این الگو را کشف و یک درس اختصاصی برای رفعش تولید می‌کند.',
  },
  {
    icon: '📚',
    title: 'درس شخصی‌سازی‌شده',
    body: 'هر درس با توجه به سطح، مهارت ضعیف و علاقه‌مندی شما ساخته می‌شود — نه یک محتوای آماده برای همه.',
  },
  {
    icon: '🔁',
    title: 'مرور هوشمند لغات',
    body: 'با الگوریتم تکرار فاصله‌دار SM-2، هر لغت دقیقاً لحظه‌ای که در حال فراموشی است به شما نشان داده می‌شود.',
  },
  {
    icon: '✍️',
    title: 'تصحیح خودکار تکالیف',
    body: 'نوشته‌تان را بفرستید؛ در چند ثانیه نمره، متن اصلاح‌شده و توضیح فارسی هر اشتباه را دریافت کنید.',
  },
];

const STEPS = [
  { n: '۱', title: 'ثبت‌نام کنید', body: 'در کمتر از یک دقیقه با ایمیل حساب بسازید.' },
  { n: '۲', title: 'آزمون تعیین سطح', body: 'سطح دقیق شما در شش مهارت سنجیده می‌شود.' },
  { n: '۳', title: 'برنامه شخصی', body: 'مسیر یادگیری اختصاصی شما ساخته می‌شود.' },
  { n: '۴', title: 'هر روز پیشرفت', body: 'درس، تمرین، مکالمه و مرور — همه در یک جا.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b backdrop-blur-lg" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="text-2xl">🎓</span>
            <span>زبان‌یار</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost">ورود</Link>
            <Link href="/signup" className="btn btn-primary">شروع رایگان</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <span className="badge bg-brand-50 text-brand-700 mb-5">
          ✨ ساخته‌شده برای فارسی‌زبانان
        </span>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          انگلیسی را با مربی هوشمندی یاد بگیرید که{' '}
          <span style={{ color: 'var(--color-brand-600)' }}>شما را می‌شناسد</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: 'var(--muted)' }}>
          زبان‌یار سطح شما را می‌سنجد، اشتباهات تکرارشونده‌تان را کشف می‌کند و برای هر ضعف،
          یک درس اختصاصی می‌سازد. تمام توضیحات به فارسی روان.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn btn-primary px-7 py-3 text-base">
            رایگان شروع کنید ←
          </Link>
          <Link href="/login" className="btn btn-ghost px-7 py-3 text-base">
            قبلاً حساب دارم
          </Link>
        </div>
        <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
          بدون نیاز به کارت بانکی · شروع فوری
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-10 text-center text-2xl font-bold">چه چیزی زبان‌یار را متفاوت می‌کند؟</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 transition-transform hover:-translate-y-1">
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 font-bold">{f.title}</h3>
              <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold">چطور کار می‌کند؟</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6 text-center">
              <div
                className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ background: 'var(--color-brand-600)' }}
              >
                {s.n}
              </div>
              <h3 className="mb-1 font-bold">{s.title}</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div
          className="rounded-3xl p-10 text-center text-white"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))' }}
        >
          <h2 className="text-2xl font-bold sm:text-3xl">همین امروز شروع کنید</h2>
          <p className="mx-auto mt-3 max-w-lg opacity-90">
            اولین قدم فقط ۵ دقیقه طول می‌کشد: آزمون تعیین سطح.
          </p>
          <Link
            href="/signup"
            className="btn mt-6 bg-white px-8 py-3 text-base font-bold"
            style={{ color: 'var(--color-brand-700)' }}
          >
            ساخت حساب رایگان
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <p>🎓 زبان‌یار — پلتفرم آموزش هوشمند زبان انگلیسی</p>
        <p className="mt-2 text-xs">ساخته‌شده با Next.js، Supabase و Vercel</p>
      </footer>
    </main>
  );
}
