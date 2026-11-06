import type { Metadata } from "next";
import { Planning } from "@/components/Planning";

export const metadata: Metadata = { title: "Calendrier · Transio" };

export default function CalendarPage() {
  return <Planning />;
}
