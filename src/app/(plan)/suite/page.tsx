import type { Metadata } from "next";
import { NextCycle } from "@/components/NextCycle";

export const metadata: Metadata = { title: "La suite · Transio" };

export default function NextCyclePage() {
  return <NextCycle />;
}
