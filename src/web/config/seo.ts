import type { Metadata } from "next";

/**
 * Robots metadata for the learner screens (practice, mock exam, progress,
 * dashboard, settings). They show nothing but the learner's own on-device
 * state, so a search result for them lands on an empty or onboarding page.
 * Links stay followable; only the pages themselves stay out of the index.
 * Next.js replaces the root layout's `robots` field as a whole, so the
 * googleBot block is repeated here.
 */
export const noindexRobots: Metadata["robots"] = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
  },
};

/** Metadata for a learner screen's segment layout. */
export const learnerScreenMetadata: Metadata = {
  robots: noindexRobots,
};
