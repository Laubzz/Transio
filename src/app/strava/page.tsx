import type { Metadata } from "next";
import { StravaCallback } from "@/components/StravaCallback";

export const metadata: Metadata = { title: "Strava · Transio" };

export default function StravaPage() {
  return <StravaCallback />;
}
