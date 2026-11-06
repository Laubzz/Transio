import type { Metadata } from "next";
import { Analyses } from "@/components/Analyses";

export const metadata: Metadata = { title: "Analyses · Transio" };

export default function AnalysesPage() {
  return <Analyses />;
}
