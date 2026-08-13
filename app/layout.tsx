import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Trip Planner",
  description: "Describe the trip. Get a real plan, day by day.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
