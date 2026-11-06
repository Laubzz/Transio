import type { Metadata } from "next";
import { Journal } from "@/components/Journal";

export const metadata: Metadata = { title: "Journal · Transio" };

export default function JournalPage() {
  return <Journal />;
}
