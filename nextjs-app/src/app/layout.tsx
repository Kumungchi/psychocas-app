import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Psychočas - Členská aplikace",
  description: "Členská aplikace pro studenty psychologie - generování a validace slev",
  keywords: ["psychologie", "studenti", "slevy", "členi"],
  authors: [{ name: "Psychočas" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/faviconV1.png", sizes: "192x192", type: "image/png" },
      { url: "/faviconV2.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/faviconV1.png", sizes: "192x192", type: "image/png" }
    ]
  },
  themeColor: "#1d4f7d",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Psychočas" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Psychočas" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1d4f7d" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/faviconV1.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/faviconV2.png" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" sizes="192x192" href="/faviconV1.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/faviconV2.png" />
      </head>
      <body className="min-h-screen bg-white text-brand-text">
        <div className="max-w-md mx-auto px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
