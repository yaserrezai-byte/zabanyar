import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Empty } from '@/components/ui';
import TeacherTabs from '@/components/teacher/TeacherTabs';

/**
 * Role gate for the whole /teacher subtree.
 *
 * Matches the pattern already used by the admin page: the session is
 * verified in proxy.ts, the ROLE is verified here on the server. RLS in
 * the database is the real boundary — this only decides what UI to show.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'teacher' && me?.role !== 'admin') {
    return (
      <Empty
        icon="🔒"
        title="دسترسی محدود"
        description="این بخش فقط برای مدرسان در دسترس است. اگر مدرس هستید و این پیام را می‌بینید، از مدیر سامانه بخواهید نقش شما را تنظیم کند."
        action={{ label: 'بازگشت به داشبورد', href: '/dashboard' }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <TeacherTabs isAdmin={me.role === 'admin'} />
      {children}
    </div>
  );
}
