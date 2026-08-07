export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const INTERNAL_DOMAIN = "tomlandia.internal";

/** Synthetic, player-invisible email derived from the username. */
export function emailForUsername(username: string) {
  return `${username.trim().toLowerCase()}@${INTERNAL_DOMAIN}`;
}
