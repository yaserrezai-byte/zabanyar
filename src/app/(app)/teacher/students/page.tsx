import { createClient } from '@/lib/supabase/server';
import { Empty } from '@/components/ui';
import StudentList from '@/components/teacher/StudentList';
import { getRosterWithStats } from '@/lib/teacher';

export const metadata = { title: 'دانش‌آموزان من | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function TeacherStudentsPage() {
  const supabase = await createClient();
  const students = await getRosterWithStats(supabase);

  if (!students.length) {
    return (
      <Empty
        icon="👥"
        title="دانش‌آموزی یافت نشد"
        description="هنوز هیچ دانش‌آموزی به شما واگذار نشده است."
        action={{ label: 'بازگشت به داشبورد', href: '/dashboard' }}
      />
    );
  }

  return <StudentList students={students} />;
}
