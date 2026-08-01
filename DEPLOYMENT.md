<div dir="rtl">

# 🚀 راهنمای استقرار زبان‌یار

این سند وضعیت فعلی استقرار و کارهای باقی‌مانده را توضیح می‌دهد.

---

## ✅ وضعیت فعلی

| مورد | وضعیت |
|---|---|
| **سایت زنده** | https://zabanyar-seven.vercel.app |
| **مخزن کد** | https://github.com/yaserrezai-byte/zabanyar |
| **پروژه Supabase** | `zabanyar-ai` — ریجن فرانکفورت (`eu-central-1`) |
| **پروژه Vercel** | `zabanyar` — محیط Production فعال |
| **دیتابیس** | ۱۴ جدول · ۶۲ policy · ۳ باکت — مایگریشن‌ها اعمال شده |
| **متغیرهای محیطی** | روی Vercel تنظیم شده (کلید سرویس رمزنگاری‌شده) |
| **CI** | GitHub Actions روی `main` و `develop` — سبز |
| **تست‌ها** | ۹۶ واحد + ۸۷ دیتابیس + ۸۸ تولید = **۲۷۱ تست، همه سبز** |

---

## ⚠️ یک قدم باقی‌مانده: اتصال خودکار GitHub ↔ Vercel

در حال حاضر استقرار **دستی** انجام می‌شود (با `vercel deploy --prod`). برای اینکه هر `git push` به‌طور خودکار منتشر شود، باید یک‌بار GitHub App وصل شود. این کار نیاز به تأیید تعاملی شما دارد و از طریق API قابل انجام نیست.

### مراحل (حدود ۱ دقیقه)

۱. وارد شوید: https://vercel.com/yaserrezai-7853/zabanyar/settings/git
۲. روی **Connect Git Repository** بزنید.
۳. گزینه **GitHub** را انتخاب و در صورت درخواست، Vercel را روی حساب `yaserrezai-byte` نصب کنید.
۴. مخزن `yaserrezai-byte/zabanyar` را انتخاب کنید.
۵. تنظیمات شاخه‌ها را این‌طور بگذارید:
   - **Production Branch:** `main`
   - سایر شاخه‌ها (از جمله `develop`) به‌طور خودکار **Preview Deployment** می‌سازند.

### بعد از اتصال

</div>

```
push به main      →  استقرار Production خودکار
push به develop   →  استقرار Preview خودکار
باز کردن PR       →  یک URL پیش‌نمایش مستقل برای بازبینی
```

<div dir="rtl">

---

## 🔐 اقدام امنیتی ضروری

توکن‌هایی که در گفت‌وگو ارسال شدند در تاریخچه چت باقی می‌مانند. **لطفاً هر سه را باطل کنید** — همه کارهای لازم با آن‌ها انجام شده و دیگر مورد نیازی نیست:

| سرویس | لینک ابطال |
|---|---|
| GitHub | https://github.com/settings/tokens |
| Vercel | https://vercel.com/account/tokens |
| Supabase | https://supabase.com/dashboard/account/tokens |

> ⚠️ ابطال این توکن‌ها **هیچ تأثیری روی سایت زنده ندارد**. متغیرهای محیطی اپلیکیشن جدا هستند و دست‌نخورده باقی می‌مانند.

هیچ‌کدام از این توکن‌ها در مخزن یا تاریخچه Git نوشته نشده‌اند — این موضوع با یک بررسی خودکار در CI هم تضمین می‌شود.

---

## 🔑 کلیدهای Supabase

اگر بعداً به آن‌ها نیاز پیدا کردید، از این مسیر قابل دریافت‌اند:

**Supabase Dashboard → Project Settings → API**

مقادیر لازم:
- `Project URL`
- `anon public` key
- `service_role` key (فقط سمت سرور — هرگز در کد کلاینت استفاده نشود)

این سه مقدار هم‌اکنون در `.env.local` (که در `.gitignore` است) و در Environment Variables پروژه Vercel قرار دارند.

---

## 🤖 فعال‌سازی هوش مصنوعی پیشرفته (اختیاری)

اپلیکیشن هم‌اکنون با **موتور محلی** کار می‌کند: ۲۴ قاعده گرامری، تولید درس، مربی، مکالمه و SM-2 — بدون هیچ هزینه‌ای و کاملاً پایدار.

برای فعال‌کردن تولید محتوای پویا با مدل زبانی:

۱. یک کلید از OpenAI (یا هر سرویس سازگار) بگیرید.
۲. در Vercel → Settings → Environment Variables اضافه کنید:

</div>

```
OPENAI_API_KEY   = sk-...
OPENAI_MODEL     = gpt-4o-mini
OPENAI_BASE_URL  = https://api.openai.com/v1     (اختیاری)
```

<div dir="rtl">

۳. یک Redeploy بزنید.

از آن لحظه، درس‌ها، مکالمه‌ها و تصحیح‌ها توسط مدل تولید می‌شوند. **اگر سرویس در دسترس نباشد یا خطا بدهد، سیستم به‌طور خودکار به موتور محلی برمی‌گردد** و هیچ قابلیتی از کار نمی‌افتد.

برای بررسی حالت فعلی: `https://zabanyar-seven.vercel.app/api/health`

---

## 🧪 اجرای تست‌ها

</div>

```bash
npm run test:unit                                   # موتور محلی (۹۶ تست)
npm run test:rls                                    # دیتابیس و امنیت (۸۷ تست)
npm run test:prod https://zabanyar-seven.vercel.app # سایت زنده (۸۸ تست)
```

<div dir="rtl">

> تست‌های `rls` و `prod` کاربر واقعی می‌سازند و در پایان خودشان پاک می‌کنند.

---

## 👤 ساخت حساب مدیر

نقش پیش‌فرض هر کاربر `student` است و کاربر نمی‌تواند خودش را ارتقا دهد (با تریگر دیتابیس مسدود شده). برای ساخت مدیر:

۱. از طریق سایت ثبت‌نام کنید.
۲. در **Supabase → SQL Editor** این را اجرا کنید:

</div>

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

<div dir="rtl">

سپس بخش «🛡️ مدیریت» در نوار بالای سایت ظاهر می‌شود.

### افزودن مدرس و تخصیص دانش‌آموز

</div>

```sql
-- ارتقای یک کاربر به مدرس
update public.profiles set role = 'teacher' where email = 'teacher@example.com';

-- تخصیص دانش‌آموز به آن مدرس
update public.profiles
set teacher_id = (select id from public.profiles where email = 'teacher@example.com')
where email = 'student@example.com';
```

<div dir="rtl">

از آن پس مدرس فقط داده‌های دانش‌آموزان خودش را می‌بیند — این محدودیت در سطح دیتابیس اعمال می‌شود، نه در کد.

---

## 🌐 دامنه اختصاصی

Vercel → Settings → Domains → افزودن دامنه، سپس رکوردهای DNS نمایش‌داده‌شده را در پنل دامنه‌تان ثبت کنید. گواهی SSL خودکار صادر می‌شود.

پس از اتصال دامنه، در **Supabase → Authentication → URL Configuration** آدرس جدید را به `Site URL` و `Redirect URLs` اضافه کنید تا لینک‌های تأیید ایمیل درست کار کنند.

---

## 📊 محدودیت‌های پلن رایگان

| سرویس | محدودیت | توضیح |
|---|---|---|
| Supabase Free | ۵۰۰ مگابایت دیتابیس · ۱ گیگ فایل | پروژه پس از ۷ روز بی‌فعالیتی موقتاً متوقف می‌شود |
| Vercel Hobby | ۱۰۰ گیگ پهنای باند · یک بیلد همزمان | برای استفاده تجاری نیاز به ارتقا دارد |

</div>
