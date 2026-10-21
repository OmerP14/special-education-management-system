/** Where to go after signing in: the `?next=` page when it is an in-app
 *  path, otherwise the dashboard. Never an external URL — `?next=` comes
 *  straight from the address bar. */
export function resolvePostLoginPath(next: string | null): string {
  if (next && /^\/app(\/|$)/.test(next)) return next;
  return "/app/dashboard";
}
