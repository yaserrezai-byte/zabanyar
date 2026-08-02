import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * PWA note: sw.js, manifest.json and the offline page must stay
     * outside the auth redirect, otherwise an anonymous browser asking
     * for the service worker gets a 307 to /login and registration
     * silently fails. `.js`/`.json`/`.webmanifest` are excluded here
     * for that reason, alongside the pre-existing image exclusions.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|js|json|webmanifest|txt|xml)$).*)',
  ],
};
