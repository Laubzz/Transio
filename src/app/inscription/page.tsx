import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Créer un compte · Transio" };

export default function SignupPage() {
  return <AuthForm mode="inscription" />;
}
