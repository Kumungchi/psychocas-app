import './globals.css';
import type { Metadata, Viewport } from 'next';
import OfflineToast from '@/components/OfflineToast';
import { LocaleProvider } from '@/hooks/useLocale';
import LocaleToggle from '@/components/LocaleToggle';

export const metadata: Metadata = {
  title: "Psychočas - Členská aplikace",
  description: "Členská aplikace pro studenty psychologie - generování a validace slev",
  keywords: ["psychologie", "studenti", "slevy", "členi"],
  authors: [{ name: "Psychočas" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/faviconV1.png", sizes: "192x192", type: "image/png" },
      { url: "/faviconV2.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/faviconV1.png", sizes: "192x192", type: "image/png" },
      { url: "/faviconV2.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/favicon.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4f7d"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <meta charSet="UTF-8" />
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Psychočas" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Psychočas" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1d4f7d" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>
        <LocaleProvider>
          <LocaleToggle />
          {children}
          <OfflineToast />
        </LocaleProvider>
      </body>
    </html>
  );
}
