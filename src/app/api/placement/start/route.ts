import { getAuth, unauthorized, serverError } from '@/lib/auth';
import { pickNextQuestion, PLACEMENT_LENGTH } from '@/lib/ai/placement-bank';
import type { PlacementQuestion } from '@/types/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await getAuth();
  if (!ctx) return unauthorized();
  const { supabase, user } = ctx;

  try {
    // resume an in-progress test if one exists
    const { data: existing } = await supabase
      .from('placement_tests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .maybeSingle();

    if (existing) {
      const asked = (existing.questions ?? []) as PlacementQuestion[];
      const answers = (existing.answers ?? []) as unknown[];
      const current = asked[answers.length];
      if (current) {
        return Response.json({
          test_id: existing.id,
          index: answers.length,
          total: PLACEMENT_LENGTH,
          question: sanitize(current),
          resumed: true,
        });
      }
    }

    const first = pickNextQuestion([], []);
    if (!first) return serverError('بانک سؤال خالی است.');

    const { data: test, error } = await supabase
      .from('placement_tests')
      .insert({
        user_id: user.id,
        status: 'in_progress',
        questions: [first],
        answers: [],
        current_index: 0,
      })
      .select('id')
      .single();

    if (error) throw error;

    return Response.json({
      test_id: test.id,
      index: 0,
      total: PLACEMENT_LENGTH,
      question: sanitize(first),
      resumed: false,
    });
  } catch (e) {
    console.error('[placement/start]', e);
    return serverError();
  }
}

function sanitize(q: PlacementQuestion) {
  const { correct_index: _c, explanation_fa: _e, error_tag: _t, ...safe } = q;
  return safe;
}
