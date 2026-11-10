import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transio",
  description:
    "Change de sport, garde tes acquis : le plan d'entraînement qui part de ton ancien sport.",
  appleWebApp: { capable: true, title: "Transio", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
