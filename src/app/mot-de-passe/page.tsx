import type { Metadata } from "next";
import { PasswordReset } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Mot de passe · Transio" };

export default function PasswordPage() {
  return <PasswordReset />;
}
