/**
 * Announce newly awarded badges to <BadgeToast />.
 *
 * Every learning API route returns `new_badges` in its payload; call
 * this with that array and the celebration UI handles the rest.
 */
export function announceBadges(badges: unknown): void {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(badges) || badges.length === 0) return;
  window.dispatchEvent(new CustomEvent('zabanyar:badges', { detail: badges }));
}
