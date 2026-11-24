import type { Metadata } from "next";
import { learnerScreenMetadata } from "@/config/seo";

/** A learner screen: kept out of search indexes (config/seo.ts). */
export const metadata: Metadata = learnerScreenMetadata;

export default function LearnerScreenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
