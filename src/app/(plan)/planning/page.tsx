import type { Metadata } from "next";
import { Planning } from "@/components/Planning";

export const metadata: Metadata = { title: "Planning · Transio" };

export default function PlanningPage() {
  return <Planning />;
}
