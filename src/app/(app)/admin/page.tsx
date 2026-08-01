import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Empty, SectionTitle, Stat } from '@/components/ui';
import { LEVEL_FA, type CefrLevel } from '@/types/db';

export const metadata = { title: 'پنل مدیریت | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  if (me?.role !== 'admin') {
    return (
      <Empty
        icon="🔒"
        title="دسترسی محدود"
        description="این بخش فقط برای مدیران سامانه در دسترس است. سیاست‌های امنیتی سطح ردیف (RLS) دسترسی شما را محدود کرده‌اند."
        action={{ label: 'بازگشت به داشبورد', href: '/dashboard' }}
      />
    );
  }

  const [{ data: users, count: userCount }, { count: lessonCount }, { count: subCount }, { count: convCount }] =
    await Promise.all([
      supabase.from('profiles')
        .select('id, full_name, email, role, current_level, streak_days, subscription, created_at', { count: 'exact' })
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('lessons').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
    ]);

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold">🛡️ پنل مدیریت</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          نمای کلی سامانه — دسترسی شما به‌عنوان مدیر از طریق RLS تأیید شده است.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="کاربران" value={userCount ?? 0} icon="👥" />
        <Stat label="درس‌ها" value={lessonCount ?? 0} icon="📚" />
        <Stat label="پاسخ‌های ثبت‌شده" value={subCount ?? 0} icon="✍️" />
        <Stat label="گفت‌وگوها" value={convCount ?? 0} icon="💬" />
      </div>

      <Card>
        <SectionTitle title="کاربران اخیر" subtitle={`${userCount ?? 0} کاربر ثبت‌شده`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <th className="p-2 font-medium">نام</th>
                <th className="p-2 font-medium">ایمیل</th>
                <th className="p-2 font-medium">نقش</th>
                <th className="p-2 font-medium">سطح</th>
                <th className="p-2 font-medium">استریک</th>
                <th className="p-2 font-medium">اشتراک</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="p-2">{u.full_name || '—'}</td>
                  <td className="ltr p-2 text-xs" dir="ltr">{u.email}</td>
                  <td className="p-2">
                    <span className={`badge ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700'
                      : u.role === 'teacher' ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-700'
                    }`}>
                      {{ student: 'زبان‌آموز', teacher: 'مدرس', admin: 'مدیر' }[u.role as string]}
                    </span>
                  </td>
                  <td className="num p-2">
                    {u.current_level ? `${u.current_level} (${LEVEL_FA[u.current_level as CefrLevel]})` : '—'}
                  </td>
                  <td className="num p-2">{u.streak_days}</td>
                  <td className="p-2">
                    <span className="badge bg-slate-100 text-slate-700">
                      {{ free: 'رایگان', pro: 'حرفه‌ای', premium: 'ویژه' }[u.subscription as string]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
