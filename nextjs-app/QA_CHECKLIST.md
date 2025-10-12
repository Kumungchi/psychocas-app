# QA & Release Checklist

Tento seznam shrnuje kroky, které je potřeba projít před nasazením Psychočas
aplikace na produkci. Plní navazující požadavky na backendovou přípravu, ruční
ověření toků a rychlý PWA test.

## 1. Automatizovaná kontrola projektu

Spusťte připravený skript, který ověří lint, unit testy a produkční build.

```bash
cd nextjs-app
npm run verify
```

> 💡 V CI prostředí nastavte potřebné proměnné (`CI=1`) automaticky – skript je
> používá interně.

## 2. Backend deploy checklist

Buď použijte zkratku `npm run deploy:all`, nebo jednotlivé kroky ze souboru
[`SUPABASE_DEPLOYMENT.md`](SUPABASE_DEPLOYMENT.md). Po dokončení ověřte stránku
`/test`, že všechny kontroly procházejí.

## 3. Manuální testy

- **Magic link login** – Odeslat magic link na členský email, potvrdit v mailu;
  ověřte, že přesměrování končí na `/home` a nevrací se na `/login`.
- **Člen aktivní** – Na `/home` otevřete kartu člena, vygenerujte token a
  potvrďte, že se zobrazí QR i textový kód a běží odpočítávání.
- **Token expirace** – Vyčkejte 3 minuty nebo klikněte na expiraci; token musí
  přejít do stavu „neplatný“ a nabídnout nové vygenerování.
- **Validace manažerem** – Přihlaste se jako `manager@psychocas.cz`, zadejte
  čerstvý kód a sledujte, že první ověření projde a druhý pokus je odmítnut.
- **Správa partnerů** – V adminu přidejte nebo pozastavte nabídku; změna by se
  měla uložit a zobrazit jen členům relevantní větve.
- **Offline snapshot** – Na `/home` přepněte prohlížeč do offline režimu; měl by
  se zobrazit banner „Offline“ a obsah se načte z cache.

## 4. Rychlý PWA test

1. `npm run build && npm run start`
2. Otevřete aplikaci v Chromu (nebo Edge) a přes *Application → Manifest*
   spusťte instalaci PWA.
3. Po instalaci přepněte zařízení do režimu offline a znovu aplikaci spusťte.
4. Očekávejte zobrazení naposledy uložené karty, partnerů a offline upozornění.
5. Zkuste kliknout na „Zkusit znovu“ – token se nezačne generovat, dokud se
   síť neobnoví.

## 5. Po testech

- Zapište výsledek do release poznámek (kdo testoval, kdy, případné poznámky).
- Pokud vše prošlo, můžete přepnout Supabase z testovacích dat na ostrá.
