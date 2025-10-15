"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabaseClient";

const LEGACY_AUTH_ENABLED = process.env.NEXT_PUBLIC_LEGACY_AUTH_ENABLED === "true";

export default function AuthComponent() {
  if (!LEGACY_AUTH_ENABLED) {
    return (
      <div className="card max-w-md mx-auto mt-8 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">🔐 Přístup omezen</h2>
        <p className="text-sm text-gray-600 text-center">
          Tato stránka je dostupná pouze administrátorům. Prosíme, použijte běžné přihlášení
          prostřednictvím magického odkazu nebo kontaktujte správce, pokud potřebujete povolit legacy
          přihlašování heslem.
        </p>
      </div>
    );
  }

  return (
    <div className="card max-w-md mx-auto mt-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">🔐 Administrátorské přihlášení</h2>
      <Auth
        supabaseClient={supabase}
        view="magic_link"
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: "#1d4f7d",
                brandAccent: "#049edb",
              },
            },
          },
        }}
        providers={[]}
        showLinks
      />
    </div>
  );
}
