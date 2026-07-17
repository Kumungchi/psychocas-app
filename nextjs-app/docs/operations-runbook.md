# Provozní runbook

Aktualizováno: 17. 7. 2026

Tento dokument popisuje minimální provozní režim beta pilotu. Neobsahuje produkční tajemství ani osobní údaje. Konkrétní incident se eviduje mimo Git v omezeném board/admin prostoru.

## Odpovědnost

| Oblast | Primární vlastník | Eskalace |
|---|---|---|
| Členství a přístupy | board/admin | statutární zástupce a technický správce |
| Partneři a nabídky | manager nebo koordinátor partnerství ve svém scope | board při schválení nebo sporu |
| Kampaně a push | PR koordinátor nebo manager ve svém scope | board při hromadném sdělení |
| Eventy a check-in | event koordinátor nebo manager ve svém scope | board při incidentu |
| Soukromí a žádosti subjektů údajů | board/admin s `privacy.manage` | pověřená odpovědná osoba |
| Dostupnost, auth, PWA a deployment | technický správce | Convex, Vercel nebo Resend support podle příčiny |

Scope a capability se vždy kontrolují serverově. Provozní nouze není důvod udělit trvalou globální roli.

## Kontroly po každém release

1. Otevřít `/`, `/login`, `/privacy` a `/v` bez přihlášení.
2. Přihlásit testovací allowlistovaný účet přes OTP a ověřit přesměrování na `/home`.
3. Zkontrolovat kartu členství, seznam nabídek, detail, oblíbené a vytvoření QR tokenu.
4. QR otevřít v nepřihlášeném mobilním prohlížeči a ověřit, že výsledek neobsahuje jméno, email ani přesné datum členství.
5. Podle testovací role otevřít `/workspace` nebo `/admin` a provést jednu neškodnou změnu s následným vrácením.
6. Ověřit manifest, registraci service workeru, instalační CTA a offline dokument.
7. Zkontrolovat Convex logy, Vercel logy a neúspěšné delivery jobs.

Používat samostatné pilotní testovací účty a testovací partner/nabídku. Produkční členská data se nesmí kopírovat do development prostředí.

## Pravidelné kontroly

### Denně během pilotu

- dostupnost veřejného webu, loginu a QR validace,
- chybovost Convex a Vercel funkcí,
- nedoručené OTP a push delivery jobs,
- otevřená hlášení nabídek a privacy requests,
- neobvyklý počet zamítnutých nebo opakovaných QR skenů.

### Týdně

- expirující členství a neaktuální access grants,
- koncepty, čekající approvals a pozastavené nabídky,
- staff assignments, jejich scope a stále potřebné capabilities,
- agregované metriky bez individuálního behaviorálního profilování,
- výsledek retenční úlohy a stav posledního backup/recovery postupu poskytovatelů.

### Měsíčně

- odebrat nepotřebné staff assignments a bootstrap výjimky,
- projít auditní logy citlivých administrativních operací,
- zkontrolovat aktuálnost privacy textu, kontaktních údajů a dodavatelů,
- provést mobilní regresní průchod na aktuálním iOS Safari a Android Chrome,
- obnovit test obnovy a incidentní kontakty.

## Závažnost incidentu

| Úroveň | Příklad | Reakce |
|---|---|---|
| P0 | únik osobních údajů, neoprávněný globální přístup, kompromitované klíče | okamžitě omezit dopad, zastavit dotčenou funkci, informovat board a zahájit bezpečnostní/GDPR postup |
| P1 | login nebo QR nefunguje většině uživatelů, chybná validace členství | okamžitá diagnostika, omezený rollback nebo oprava, průběžná komunikace pilotu |
| P2 | nefunguje jednotlivá nabídka, push nebo staff workflow | vyřešit v nejbližším provozním okně, nabídku lze dočasně pozastavit |
| P3 | kosmetická chyba nebo jednotlivý nekritický požadavek | zařadit do backlogu s reprodukcí a dopadem |

U P0 a P1 zaznamenat čas zjištění, dopad, dotčenou verzi, provedené kroky a rozhodnutí. Do incidentního záznamu nevkládat OTP, QR secret, JWT ani celé exporty uživatelů.

## Login a OTP

Když email nepřijde:

1. ověřit, že email má aktivní `accessGrant` nebo jde o aktuální bootstrap admin adresu,
2. zkontrolovat spam a přesnou adresu příjemce,
3. ověřit rate limit OTP požadavků,
4. zkontrolovat Convex action log a Resend delivery stav,
5. ověřit `AUTH_EMAIL_FROM`, doménu odesílatele a `AUTH_RESEND_KEY` v daném Convex deploymentu,
6. neposílat OTP ručně a nelogovat jeho hodnotu.

Při podezření na kompromitovaný účet deaktivovat access grant a případný staff assignment. Citlivé operace znovu kontrolují aktivní grant, takže odebrání přístupu není závislé jen na skrytí UI.

## QR validace

Když QR nefunguje:

1. ověřit, zda je nabídka publikovaná a v platnosti,
2. ověřit aktivní členství a stáří tokenu; token platí tři minuty,
3. zkusit ruční osmimístný kód na `/v`,
4. zkontrolovat `POST /qr/validate` a Convex HTTP log bez kopírování secretu,
5. odlišit očekávané stavy `expired`, `already_used` a `invalid` od serverové chyby,
6. při chybné nabídce ji dočasně pozastavit a informovat vlastníka partnerství.

Partner nepotřebuje účet ani speciální skener. Veřejný výsledek potvrzuje pouze platnost členství a nabídky; identita člena zůstává skrytá.

## PWA, instalace a offline režim

Když se nenabízí instalace:

1. ověřit HTTPS, `/manifest.webmanifest`, ikony a úspěšnou registraci `/sw.js`,
2. počítat s tím, že browser rozhoduje o události instalačního promptu; iOS používá systémovou akci Přidat na plochu,
3. ověřit, že aplikace není už nainstalovaná nebo spuštěná ve standalone režimu,
4. zkontrolovat konzoli prohlížeče a service-worker scope.

Při starém UI nejprve udělat normální reload online. Teprve potom odregistrovat service worker a vymazat data webu na testovacím zařízení. Soukromé route, auth a QR validace musí zůstat network-only; offline snapshot je omezený a nejvýše 24 hodin starý.

## Oprávnění a scope

Když uživatel nevidí očekávanou akci:

1. ověřit aktivní access grant a členský stav,
2. ověřit staff assignment, roli, capability a časovou platnost,
3. ověřit `national` nebo odpovídající `branchId` scope,
4. ověřit, že záznam partnera, nabídky nebo eventu patří do stejného scope,
5. použít audit log k dohledání poslední změny oprávnění.

Nikdy neopravovat problém přidáním role `admin`, pokud stačí konkrétní capability a lokální scope. Změnu oprávnění musí provést board/admin a po vyřešení se má znovu ověřit princip nejmenších oprávnění.

## Nabídky, hlášení a kampaně

- Chybnou nebo spornou nabídku pozastavit, zachovat auditní stopu a kontaktovat vlastníka partnerství.
- Otevřené hlášení převést do `reviewing`, ověřit podmínky u partnera a uzavřít až po opravě nebo zdokumentovaném rozhodnutí.
- Hromadnou kampaň neposílat bez kontroly scope, cílové skupiny, textu a preference příjemců.
- Neúspěšné delivery jobs opakovat až po odstranění příčiny; opakování nesmí vytvořit duplicitní kampaň.

## Privacy a bezpečnostní incident

1. Omezit další zpracování nebo přístup, ale nemažte důkazy a auditní stopu.
2. Informovat board a odpovědnou osobu pro ochranu osobních údajů.
3. Určit dotčená data, subjekty, dobu, příčinu a rozsah.
4. Rotovat kompromitované klíče v Convexu a navazujících službách; žádný nový klíč neukládat do Git historie.
5. Posoudit oznamovací povinnosti a lhůty podle platného GDPR postupu organizace.
6. Opravu ověřit testem, zapsat příčinu a následné preventivní opatření.

Žádosti o export, opravu nebo výmaz zpracovává pouze uživatel s `privacy.manage`. Automatický export je dostupný přihlášenému členovi pro jeho vlastní data; ostatní žádosti vyžadují řízené vyřízení a audit.

## Rollback a obnova

- Frontend lze vrátit přes Vercel na poslední ověřený deployment.
- Convex změny schématu a funkcí musí být zpětně kompatibilní s frontendem po dobu rollout/rollback okna.
- Před destruktivní opravou dat vytvořit reprodukovatelný seznam dotčených ID a schválený postup; nepoužívat hromadné ruční zásahy bez auditu.
- Po rollbacku zopakovat celý post-release smoke test a ověřit, že produkční frontend míří na správný produkční Convex deployment.

Detailní build a release postup je v [Vývoj a release](development-release.md). Datové a retenční zásady jsou v [Data, soukromí a bezpečnost](data-privacy-security.md).
