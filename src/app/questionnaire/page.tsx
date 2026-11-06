import type { Metadata } from "next";
import { Questionnaire } from "@/components/Questionnaire";

export const metadata: Metadata = { title: "Créer mon plan · Transio" };

export default function QuestionnairePage() {
  return <Questionnaire />;
}
