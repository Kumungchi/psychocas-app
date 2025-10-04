import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { 
  title: "Psychočas", 
  description: "Member app" 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-white text-brand-text">
        <div className="max-w-md mx-auto px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
