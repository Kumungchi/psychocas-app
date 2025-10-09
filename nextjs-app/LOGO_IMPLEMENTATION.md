# Psychočas Logo - Kompletní implementace

## 📍 Kde je logo použito

Logo s hodinami (reprezentující "čas" v názvu Psychočas) je nyní implementováno na těchto místech:

### 1. **Favicon a ikony** ✅
- `/public/favicon.svg` - 32x32 verze pro browser tab
- `/public/icon.svg` - 192x192 verze pro PWA/mobile

### 2. **Email šablona** ✅
- `/email-templates/magic-link.html` - Logo v hlavičce emailu s Magic Linkem
- SVG inline kód s 80x80 velikostí

### 3. **Přihlašovací stránka** ✅
- `/src/app/login/page.tsx` - Logo nad přihlašovacím formulářem (100x100)

### 4. **Domovská stránka** ✅
- `/src/app/home/page.tsx` - Logo v hlavičce (80x80)

### 5. **Callback stránka** ✅
- `/src/app/auth/callback/page.tsx` - Logo při zpracování Magic Linku (70x70)

### 6. **Root landing page** ✅
- `/src/app/page.tsx` - Logo na vstupní stránce (100x100)

### 7. **Komponenta** ✅
- `/src/components/PsychocasLogo.tsx` - Znovupoužitelná komponenta

## 🎨 Design specifikace

### Barvy
- **Gradient**: `#1d4f7d` → `#049edb` (Psychočas brand)
- **Bílé prvky**: Hodinky, ručičky, značky

### Struktura
```
- Kruhové pozadí s gradientem (r=55)
- Vnější kruh hodinek (r=50, stroke-width=6)
- Hodinová ručička: Ukazuje na 10 hodin
- Minutová ručička: Ukazuje na 2 minuty (10:10 pozice)
- Střední tečka (r=6)
- 4 značky na 12, 3, 6, 9 hodin (r=4)
```

### Velikosti
- **Small**: 70px (callback)
- **Medium**: 80px (home, email)
- **Large**: 100px (login, root)

## 💡 Použití komponenty

```tsx
import PsychocasLogo from '@/components/PsychocasLogo';

// Výchozí velikost (100px)
<PsychocasLogo />

// Vlastní velikost
<PsychocasLogo size={80} />

// S unikátním gradient ID (pro více log na stránce)
<PsychocasLogo size={100} gradientId="myUniqueGradient" />
```

## 🔄 Aktualizace stávajících stránek

Všechny klíčové stránky byly aktualizovány inline SVG kódem pro okamžité zobrazení loga.
Pro budoucí stránky doporučujeme použít `<PsychocasLogo />` komponentu.

## ✅ Dokončeno

- [x] Favicon (browser tab)
- [x] PWA icon (mobile)
- [x] Email šablona
- [x] Login page
- [x] Home page
- [x] Callback page
- [x] Root page
- [x] Reusable component

---

**Vytvořeno**: 9. října 2025
**Brandová identita**: Logo s hodinami symbolizující "čas" v názvu Psychočas
