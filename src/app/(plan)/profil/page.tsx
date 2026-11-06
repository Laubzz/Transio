import type { Metadata } from "next";
import { Profile } from "@/components/Profile";

export const metadata: Metadata = { title: "Profil · Transio" };

export default function ProfilePage() {
  return <Profile />;
}
