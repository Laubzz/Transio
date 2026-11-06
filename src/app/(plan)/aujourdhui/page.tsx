import type { Metadata } from "next";
import { Today } from "@/components/Today";

export const metadata: Metadata = { title: "Aujourd'hui · Transio" };

export default function TodayPage() {
  return <Today />;
}
