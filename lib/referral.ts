/**
 * Single source of truth for the referral link.
 *
 * Three places on the site hand a referral link to the clipboard: the
 * "Your invite link:" row in Refer & Earn, the share button under the roadmap,
 * and the share button in the last section. They must always copy byte-for-byte
 * the same string, so all three read from here rather than rebuilding it.
 *
 * To change the link format or the pre-signup placeholder, edit this file only.
 */

/**
 * Direct capture does not create a personal referral link. Sharing therefore
 * defaults to the exact bare public URL, without tracking or reward claims.
 */
export const PRODUCTION_ORIGIN = "https://prompt-launchpad-waitlist.vercel.app";
export const REFERRAL_PLACEHOLDER = PRODUCTION_ORIGIN;

/**
 * Personal links always use the production domain, including when rendered
 * from previews. Only pass a code obtained after proving inbox ownership.
 * The origin parameter remains for compatibility with existing callers.
 */
export function buildReferralLink(origin: string, code: string | null): string | null {
  void origin;
  if (!code || !/^[a-zA-Z0-9_-]{1,128}$/.test(code)) return null;
  return `${PRODUCTION_ORIGIN}/?ref=${encodeURIComponent(code)}`;
}

/** What any of the three copy affordances should put on the clipboard. */
export function referralTextToCopy(link: string | null): string {
  return link ?? REFERRAL_PLACEHOLDER;
}
