# Produkt a role

Aktualizováno: 18. 7. 2026

## Produktový účel

Psychočas sjednocuje členský průkaz, partnerské výhody, události a zpětnou vazbu do jedné instalovatelné webové aplikace. Pro člena má být hlavní hodnota dostupná do několika sekund: otevřít aplikaci, najít relevantní nabídku a bezpečně ji uplatnit.

Partner nemá vlastní účet. Obsluha naskenuje QR běžným fotoaparátem nebo zadá osmimístný kód na veřejné stránce. Výsledek sdělí pouze platnost členství a nabídky, ne jméno, email ani přesné datum členství.

## Aktuální funkce pro člena

- aktivní digitální členství s pobočkou a platností,
- národní a lokální nabídky podle pobočky,
- hledání, kategorie, řazení, oblíbené a filtr končících nabídek,
- detail nabídky s instrukcemi, podmínkami, adresou a datem ověření,
- jednorázový QR kód s platností tři minuty,
- realtime potvrzení úspěšného skenu,
- jednorázové hodnocení průběhu uplatnění,
- hlášení neaktuální nebo problematické nabídky,
- nadcházející události,
- volitelné push notifikace a tématické preference,
- obecný feedback a návrh nového partnera,
- export vlastních dat a podání privacy požadavku,
- české a anglické rozhraní,
- instalace PWA a bezpečný offline snapshot.

## Staff povrchy

### Pracovní prostor `/workspace`

Zobrazené moduly se odvozují z capabilities aktivních assignments:

- omezená členská diagnostika pro support,
- partneři a adresy provozoven,
- nabídky, podmínky a schvalování,
- členská hlášení a agregovaný redemption feedback,
- kampaně a push fronta,
- události a check-in,
- approval fronta,
- agregované QR metriky,
- privacy požadavky.

### Administrace `/admin`

Board a admin zde spravují:

- allowlist a stav členského přístupu,
- platnost členství,
- role a pobočku,
- CSV import s kontrolním náhledem a bezpečným přeskočením nebo aktualizací existujících emailů,
- hromadné změny vybraných členů,
- pobočky,
- staff preset, national/local scope a revokaci assignmentu.

## Model oprávnění

Oprávnění nejsou jen jedna hierarchická role. Staff přístup je kombinace:

- `preset`: typ práce a sada capabilities,
- `scope`: celá organizace nebo jedna pobočka,
- `status` a případná časová platnost assignmentu.

### Presety a capabilities

| Preset | Přidělené capabilities | Typické použití |
|---|---|---|
| `support` | `support.read` | Omezená diagnostika účtu bez historie nabídek a QR. |
| `coordinator_hr` | `membership.read` | Čtení členského adresáře v povoleném scope. |
| `coordinator_pr` | `campaign.draft` | Příprava kampaní. |
| `coordinator_partnerships` | `partner.draft`, `offer.draft`, `metrics.read` | Příprava partnerů a nabídek, agregované metriky. |
| `coordinator_events` | `event.manage`, `event.check_in` | Správa událostí a odbavení. |
| `manager` | membership read, support, partner/offer draft+publish, campaign draft+send, event manage+check-in, metrics | Provoz pobočky nebo delegovaného organizačního scope. |
| `board` | všechny capabilities | Business governance, členství, schvalování, privacy a audit. |
| `admin` | všechny capabilities | IAM a technická administrace. |

Člen bez staff assignmentu pracuje pouze se svým profilem a členskými funkcemi.

Legacy role `manager`, `board` nebo `admin` zůstává během přechodu kompatibilní. Administrace umí atomicky vytvořit assignment a změnit základní roli na `member`; tím nevznikne mezera bez přístupu a audit zachytí původní i výsledný stav. Poslední aktivní board/admin přístup nelze tímto postupem odebrat.

### Scope

| Scope | Význam |
|---|---|
| `organization` | Oprávnění platí pro celou organizaci a národní workflow. |
| `branch` | Oprávnění platí jen pro jednu konkrétní pobočku. |

Server vždy porovnává organizaci a pobočku assignmentu s cílovým zdrojem. Klientem poslaný `branchId` není sám o sobě důvěryhodný.

## Základní pravidla governance

- Členství mění pouze board/admin s `membership.manage`.
- Pobočky mění pouze `branch.manage`.
- Staff assignments mění pouze `assignment.manage`.
- Draft partnera nebo nabídky vyžaduje odpovídající draft capability ve stejném scope.
- Publikace nabídky vyžaduje `offer.publish`.
- Hromadné odeslání kampaně vyžaduje `campaign.send`.
- Privacy fronta vyžaduje `privacy.manage`.
- Metriky neobsahují členský žebříček ani individuální historii použití.
- Support výsledek výslovně neobsahuje historii nabídek ani QR.

## Produktové hranice pilotu

- PWA zůstává hlavní distribuční forma; nativní aplikace není v plánu pilotu.
- Partner nemá účet ani dashboard.
- Není dovoleno behaviorální doporučování podle individuální historie slev.
- Nejsou body, streaky ani gamifikace motivující k utrácení.
- Personalizace je omezená na pobočku, obsah nabídky, oblíbené a explicitní preference.
- Board pracuje s agregacemi, ne s nákupním profilem člena.
