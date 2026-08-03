'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CefrLevel, Profile } from '@/types/db';
import { CEFR_LEVELS, LEVEL_FA } from '@/types/db';
import { Alert, Card, Spinner } from '@/components/ui';

const INTEREST_OPTIONS = [
  'سفر', 'فیلم و سریال', 'موسیقی', 'ورزش', 'فناوری', 'کسب‌وکار',
  'آشپزی', 'کتاب و ادبیات', 'علم', 'بازی', 'هنر', 'سلامتی',
  'مهاجرت', 'مصاحبه شغلی', 'آزمون آیلتس', 'زندگی روزمره',
];

const GOALS = [
  { min: 10, label: '۱۰ دقیقه', desc: 'سبک و روزمره' },
  { min: 20, label: '۲۰ دقیقه', desc: 'متعادل و پیشنهادی' },
  { min: 40, label: '۴۰ دقیقه', desc: 'جدی' },
  { min: 60, label: '۶۰ دقیقه', desc: 'فشرده' },
];

export default function OnboardingWizard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.full_name ?? '');
  const [goal, setGoal] = useState(profile.daily_goal_min || 20);
  const [target, setTarget] = useState<CefrLevel>(profile.target_level ?? 'B2');
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (i: string) =>
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 6 ? [...prev, i] : prev
    );

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim() || null,
        daily_goal_min: goal,
        target_level: target,
        interests,
        onboarding_done: true,
      })
      .eq('id', profile.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push(profile.placement_done ? '/dashboard' : '/placement');
    router.refresh();
  }

  const steps = ['خوش‌آمدگویی', 'هدف روزانه', 'سطح هدف', 'علاقه‌مندی‌ها'];

  return (
    <div className="fade-in">
      {/* progress */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ background: i <= step ? 'var(--color-primary-600)' : 'var(--border)' }}
            />
            <div className="mt-1.5 text-center text-[11px]" style={{ color: i <= step ? 'var(--color-primary-600)' : 'var(--muted)' }}>
              {s}
            </div>
          </div>
        ))}
      </div>

      <Card className="p-7">
        {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mb-2 text-4xl">👋</div>
              <h1 className="text-xl font-bold">خوش آمدید!</h1>
              <p className="mt-2 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                برای اینکه مسیر یادگیری شما را شخصی‌سازی کنیم، چند سؤال کوتاه می‌پرسیم.
                کمتر از یک دقیقه طول می‌کشد.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">شما را چه صدا کنیم؟</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام شما"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">🎯 هر روز چقدر وقت دارید؟</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                تداوم از مقدار مهم‌تر است. یک هدف واقع‌بینانه انتخاب کنید.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.min}
                  onClick={() => setGoal(g.min)}
                  className="rounded-xl border-2 p-4 text-center transition-all"
                  style={{
                    borderColor: goal === g.min ? 'var(--color-primary-600)' : 'var(--border)',
                    background: goal === g.min ? 'var(--color-primary-50)' : 'transparent',
                  }}
                >
                  <div className="text-lg font-bold">{g.label}</div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{g.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">🚀 به چه سطحی می‌خواهید برسید؟</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                سطح فعلی شما در آزمون تعیین سطح مشخص می‌شود.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {CEFR_LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setTarget(l)}
                  className="rounded-xl border-2 p-3 text-center transition-all"
                  style={{
                    borderColor: target === l ? 'var(--color-primary-600)' : 'var(--border)',
                    background: target === l ? 'var(--color-primary-50)' : 'transparent',
                  }}
                >
                  <div className="num text-base font-bold">{l}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>{LEVEL_FA[l]}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">❤️ به چه موضوعاتی علاقه دارید؟</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                درس‌ها و مکالمه‌ها حول این موضوعات ساخته می‌شوند. تا ۶ مورد انتخاب کنید.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className="rounded-full border px-3.5 py-1.5 text-sm transition-all"
                  style={{
                    borderColor: interests.includes(i) ? 'var(--color-primary-600)' : 'var(--border)',
                    background: interests.includes(i) ? 'var(--color-primary-600)' : 'transparent',
                    color: interests.includes(i) ? '#fff' : 'var(--fg)',
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              انتخاب‌شده: {interests.length} از ۶
            </p>
          </div>
        )}

        <div className="mt-7 flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="btn btn-ghost">
              → قبلی
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep((s) => s + 1)} className="btn btn-primary flex-1">
              بعدی ←
            </button>
          ) : (
            <button onClick={save} className="btn btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner /> : profile.placement_done ? 'ذخیره و بازگشت' : 'ذخیره و شروع آزمون تعیین سطح'}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
