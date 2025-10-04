# Psychočas App

Moderní členská aplikace postavená na Next.js s Tailwind CSS a Supabase.

## 📁 Struktura projektu

```
psyhocas-app/
├── desing/              # Původní Vite prototyp
└── nextjs-app/          # Hlavní Next.js aplikace
    ├── src/
    │   ├── app/         # Next.js App Router stránky
    │   │   ├── login/   # Přihlášení
    │   │   ├── home/    # Domovská stránka
    │   │   ├── redeem/  # Uplatnění kódů
    │   │   ├── validate/# Validace členství
    │   │   ├── stats/   # Statistiky
    │   │   └── technician/ # Technické nástroje
    │   ├── components/  # React komponenty
    │   └── lib/        # Utility funkce
    └── tailwind.config.js
```

## 🚀 Rychlý start

1. **Klonování repozitáře**
   ```bash
   git clone https://github.com/Kumungchi/psychocas-app.git
   cd psychocas-app
   ```

2. **Nastavení Next.js aplikace**
   ```bash
   cd nextjs-app
   npm install
   ```

3. **Konfigurace Supabase**
   - Zkopírujte `.env.local.example` do `.env.local`
   - Vyplňte vaše Supabase údaje

4. **Spuštění dev serveru**
   ```bash
   npm run dev
   ```

5. **Otevření aplikace**
   Navigujte na [http://localhost:3000](http://localhost:3000)

## 🛠️ Technologie

- **Framework**: Next.js 15 s App Router
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (autentifikace + databáze)
- **TypeScript**: Plná type safety
- **Deployment**: Připraveno pro Vercel

## 📱 Funkce

- ✅ Přihlášení členů
- ✅ Zobrazení stavu členství
- ✅ Uplatnění slevových kódů
- ✅ Validace členství
- ✅ Statistiky využití
- ✅ Technické nástroje
- ✅ Mobile-first design
- ✅ Offline-ready PWA možnosti

## 🎨 Design systém

Aplikace používá konzistentní brand barvy:
- **Primární modrá**: `#007bff`
- **Danger červená**: `#dc3545`
- **Text**: `#333333`

## 🔧 Vývoj

```bash
# Instalace závislostí
npm install

# Spuštění dev serveru
npm run dev

# Build pro produkci
npm run build

# Spuštění produkční verze
npm start

# Linting
npm run lint
```

## 📝 Licence

Tento projekt je licencován pod MIT licencí.