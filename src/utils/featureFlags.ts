/**
 * Launch-time feature flags for FastTrack.
 */

/**
 * v1 launch switch: all Pro-gated features are unlocked for every user.
 *
 * The app ships to the Play Store without real billing wired up, so we cannot
 * legally show a priced purchase flow. Instead of leaving features locked with
 * no way to buy them, everyone gets full access. Flip this to `false` once
 * Google Play Billing is integrated to restore the free/Pro boundary.
 */
export const PRO_UNLOCKED_FOR_LAUNCH = true;
