import { AppShell } from "@/components/AppShell";

export default function PlanLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
