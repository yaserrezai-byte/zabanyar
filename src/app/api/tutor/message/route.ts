import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { buildLearnerContext, recordMistakes, tutorReply } from '@/lib/ai/service';
import { getActiveLanguage } from '@/lib/active-language';
import { checkBadges } from '@/lib/gamification';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  conversation_id: z.string().uuid().optional(),
  text: z.string().min(1).max(2000),
  scenario: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return badRequest('پیام نامعتبر است.'); }

  try {
    const language = await getActiveLanguage(supabase, user.id);

    // resolve conversation
    let convId = body.conversation_id;
    if (!convId) {
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          language,
          title: body.text.slice(0, 40) || 'گفت‌وگوی جدید',
          scenario: body.scenario ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      convId = conv.id;
    }

    const [ctx, historyRes] = await Promise.all([
      buildLearnerContext(supabase, user.id, language),
      supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const history = (historyRes.data ?? [])
      .reverse()
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // save user message
    await supabase.from('messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: body.text,
    });

    const result = await tutorReply(body.text, ctx, history, body.scenario);

    // save assistant message
    const { data: saved } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        user_id: user.id,
        role: 'assistant',
        content: result.reply,
        translation_fa: result.translation_fa,
        corrections: result.corrections,
      })
      .select('id, created_at')
      .single();

    // memory updates
    await Promise.all([
      recordMistakes(
        supabase, user.id,
        result.corrections.map((c) => ({ ...c, skill: 'speaking' as const })),
        language
      ),
      supabase
        .from('conversations')
        .update({
          message_count: history.length + 2,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', convId),
      supabase.from('learning_history').insert({
        user_id: user.id,
        language,
        event_type: 'conversation_turn',
        skill: 'speaking',
        duration_sec: 60,
        xp: 5,
        meta: { corrections: result.corrections.length },
      }),
      result.new_words.length
        ? supabase.from('vocabulary_memory').upsert(
            result.new_words.map((w) => ({
              user_id: user.id,
              language,
              word: w.word,
              meaning_fa: w.meaning_fa,
              example_en: w.example_en ?? null,
              example_fa: w.example_fa ?? null,
              level: ctx.level ?? 'A2',
              source: 'conversation',
            })),
            { onConflict: 'user_id,language,word', ignoreDuplicates: true }
          )
        : Promise.resolve(),
    ]);

    const newBadges = await checkBadges(supabase, user.id);

    return Response.json({
      new_badges: newBadges,
      conversation_id: convId,
      message_id: saved?.id,
      reply: result.reply,
      translation_fa: result.translation_fa,
      corrections: result.corrections,
      new_words: result.new_words,
      source: result.source,
    });
  } catch (e) {
    console.error('[tutor/message]', e);
    return serverError();
  }
}
