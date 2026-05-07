/** Server-only: whether Facebook OAuth is configured (mirrors `src/auth.ts` provider list). */
export function isFacebookAuthEnabled(): boolean {
  return !!(
    process.env.AUTH_FACEBOOK_ID?.trim() && process.env.AUTH_FACEBOOK_SECRET?.trim()
  );
}
