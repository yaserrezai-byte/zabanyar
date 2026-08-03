'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================
 * زبان‌یار | Speak — pronunciation for any English text
 *
 * Uses the browser's built-in Web Speech API: free, offline on most
 * devices, and no API key.
 *
 * Accent policy: American English (en-US) only. Learners should hear one
 * consistent accent — mixing US and UK voices across screens teaches
 * contradictory pronunciations (e.g. "schedule", "water", rhotic /r/).
 * A non-US English voice is used only as a last resort when the device
 * ships no en-US voice at all.
 * ============================================================ */

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Voices load asynchronously in most browsers; resolve them once. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices) return Promise.resolve(cachedVoices);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length) {
      cachedVoices = immediate;
      resolve(immediate);
      return;
    }
    const onChange = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        cachedVoices = v;
        window.speechSynthesis.removeEventListener('voiceschanged', onChange);
        resolve(v);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    // Safari sometimes never fires the event.
    window.setTimeout(() => {
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v;
      resolve(v);
    }, 1200);
  });

  return voicesPromise;
}

/** Normalise a voice's BCP-47 tag: 'en_US', 'en-us' -> 'en-us'. */
function tag(v: SpeechSynthesisVoice): string {
  return (v.lang ?? '').toLowerCase().replace('_', '-');
}

function isAmerican(v: SpeechSynthesisVoice): boolean {
  return tag(v).startsWith('en-us');
}

/**
 * Pick the best American English voice available.
 *
 * Order: named high-quality en-US voices -> any en-US voice ->
 * generic 'en' -> any English voice (last resort).
 */
function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const english = voices.filter((v) => tag(v).startsWith('en'));
  if (!english.length) return null;

  const american = english.filter(isAmerican);

  // Known-good US voices across Chrome / Safari / Edge / Android.
  const preferred = [
    /google us english/i,
    /samantha/i,
    /^alex$/i,
    /microsoft (aria|jenny|guy|davis|christopher|eric|michelle)/i,
    /microsoft (zira|david|mark)/i,
    /en-us-.*(neural|wavenet)/i,
  ];

  for (const pattern of preferred) {
    const hit = american.find((v) => pattern.test(v.name));
    if (hit) return hit;
  }

  // Any en-US voice, preferring a local (offline, usually better) one.
  if (american.length) {
    return american.find((v) => v.localService) ?? american[0];
  }

  // No en-US on this device: accept a region-less 'en' before a
  // definitely-non-US accent such as en-GB or en-AU.
  const neutral = english.find((v) => tag(v) === 'en');
  if (neutral) return neutral;

  return english[0];
}

export type SpeakSize = 'xs' | 'sm' | 'md';

const SIZES: Record<SpeakSize, { box: number; font: string }> = {
  xs: { box: 22, font: '0.7rem' },
  sm: { box: 28, font: '0.85rem' },
  md: { box: 36, font: '1rem' },
};

/**
 * A small speaker button that reads `text` aloud in English.
 *
 * Renders nothing when the text has no Latin letters, so it never
 * appears next to Persian-only content by mistake.
 */
export default function Speak({
  text,
  size = 'sm',
  slow = false,
  label,
  className = '',
}: {
  text: string;
  size?: SpeakSize;
  /** Read at a slower rate — useful for long example sentences. */
  slow?: boolean;
  /** Optional visible label instead of an icon-only button. */
  label?: string;
  className?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  // Lazy initialiser: evaluated once on the client, so no effect and no
  // hydration mismatch (the server renders nothing for this component).
  const [supported] = useState(
    () => typeof window !== 'undefined' && !!window.speechSynthesis
  );
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop speaking if the component unmounts mid-utterance.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis && utterRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    async (e: React.MouseEvent) => {
      // Never trigger a parent card/link.
      e.preventDefault();
      e.stopPropagation();

      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // Second click stops playback.
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        if (utterRef.current) {
          utterRef.current = null;
          return;
        }
      }

      const clean = text.trim();
      if (!clean) return;

      const voices = await loadVoices();
      const voice = pickEnglishVoice(voices);

      const u = new SpeechSynthesisUtterance(clean);
      // Always request American English; only defer to the voice's own tag
      // when that voice is itself en-US.
      u.lang = voice && isAmerican(voice) ? voice.lang : 'en-US';
      if (voice) u.voice = voice;
      // A single word is clearer read a little slower.
      u.rate = slow ? 0.7 : clean.split(/\s+/).length === 1 ? 0.8 : 0.92;
      u.pitch = 1;

      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        utterRef.current = null;
      };
      u.onerror = () => {
        setSpeaking(false);
        utterRef.current = null;
      };

      utterRef.current = u;
      window.speechSynthesis.cancel(); // clear any queued utterance
      window.speechSynthesis.speak(u);
    },
    [text, slow]
  );

  // Nothing to pronounce.
  if (!supported) return null;
  if (!/[a-zA-Z]/.test(text)) return null;

  const s = SIZES[size];

  if (label) {
    return (
      <button
        type="button"
        onClick={speak}
        aria-label={`شنیدن تلفظ: ${text.slice(0, 40)}`}
        title="شنیدن تلفظ"
        className={`btn btn-ghost py-1.5 text-sm ${className}`}
      >
        <span aria-hidden>{speaking ? '⏸️' : '🔊'}</span>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`شنیدن تلفظ: ${text.slice(0, 40)}`}
      title="شنیدن تلفظ"
      className={`shrink-0 rounded-lg transition-colors hover:bg-primary-50 ${className}`}
      style={{
        width: s.box,
        height: s.box,
        fontSize: s.font,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: speaking ? 'var(--color-primary-600)' : 'var(--muted)',
        verticalAlign: 'middle',
      }}
    >
      <span aria-hidden className={speaking ? 'animate-pulse' : ''}>
        {speaking ? '🔊' : '🔈'}
      </span>
    </button>
  );
}

/**
 * English text with a speaker button attached.
 * Keeps LTR direction and the pronunciation control together so callers
 * do not have to repeat the same markup everywhere.
 */
export function SpeakableText({
  text,
  className = '',
  size = 'sm',
  slow = false,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  size?: SpeakSize;
  slow?: boolean;
  as?: 'span' | 'p' | 'div';
}) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <Tag className={`ltr ${className}`} dir="ltr">
        {text}
      </Tag>
      <Speak text={text} size={size} slow={slow} />
    </span>
  );
}
