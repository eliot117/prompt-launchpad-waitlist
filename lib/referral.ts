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
 * Shown (and copied) before a signup exists, when there is no personal code yet.
 * Unlike a placeholder on a domain nobody owns, this one is real: it's the
 * project's actual Vercel domain, and app/invite/route.ts makes it resolve --
 * pasting it into a browser lands on the home page rather than 404ing.
 * It carries no ?ref=, so it never attributes a referral by itself; it is a
 * safe thing to show or copy before a personal code exists.
 */
export const REFERRAL_PLACEHOLDER = "prompt-launchpad-waitlist.vercel.app/invite";

/**
 * The real, personalised link. Built from the live origin so it works on
 * whatever domain actually serves the site -- localhost, the Vercel URL, or a
 * custom domain later -- with no code change.
 *
 * Returns null until both halves are known: `origin` is empty during SSR, and
 * `code` is null until the visitor has signed up on this browser.
 */
export function buildReferralLink(origin: string, code: string | null): string | null {
  if (!origin || !code) return null;
  return `${origin}/?ref=${code}`;
}

/** What any of the three copy affordances should put on the clipboard. */
export function referralTextToCopy(link: string | null): string {
  return link ?? REFERRAL_PLACEHOLDER;
}
