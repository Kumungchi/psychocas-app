import type { Locale } from './config';

type TranslationDictionary = Record<string, string | TranslationDictionary>;

type LocaleDictionaries = Record<Locale, TranslationDictionary>;

export const dictionaries: LocaleDictionaries = {
  cs: {
    navigation: {
      home: 'Domů',
      validate: 'Ověření',
      stats: 'Statistiky',
      technician: 'Správa',
      logout: 'Odhlásit',
      mainNav: 'Hlavní navigace',
    },
    home: {
      welcome: 'Vítejte zpět',
      membership: 'Členství',
      membershipStatus: 'Stav členství',
      membershipActive: 'Aktivní člen',
      membershipInactive: 'Neaktivní člen',
      expiry: 'Platnost do',
      refresh: 'Obnovit data',
      generateToken: 'Vygenerovat nový kód',
      lastSynced: 'Poslední synchronizace',
      offlineToken: 'Offline kódy',
      tokenHistory: 'Historie kódů',
      manageProfile: 'Upravit profil',
      profileTitle: 'Profil člena',
      saveProfile: 'Uložit změny',
      close: 'Zavřít',
      saving: 'Ukládání…',
      phone: 'Telefon',
      branchPreference: 'Preferovaná pobočka',
      successProfile: 'Profil byl úspěšně aktualizován.',
    },
    validate: {
      heading: 'Ověření kódu',
      instructions: 'Naskenujte QR kód nebo zadejte kód ručně.',
      placeholder: 'Zadejte členský kód',
      submit: 'Ověřit',
    },
    stats: {
      heading: 'Statistiky',
      summary: 'Souhrn výkonu',
      redemptions: 'Ověření',
      newMembers: 'Noví členové',
      activeTokens: 'Aktivní kódy',
      partnerUptake: 'Využití partnerů',
    },
    technician: {
      heading: 'Technická správa',
      members: 'Členové',
      trusted: 'Důvěryhodní uživatelé',
      activeCount: 'Aktivní členové',
      pendingApprovals: 'Čekající schválení',
      expiringAccess: 'Brzké vypršení',
    },
  },
  en: {
    navigation: {
      home: 'Home',
      validate: 'Validate',
      stats: 'Stats',
      technician: 'Admin',
      logout: 'Sign out',
      mainNav: 'Main navigation',
    },
    home: {
      welcome: 'Welcome back',
      membership: 'Membership',
      membershipStatus: 'Membership status',
      membershipActive: 'Membership active',
      membershipInactive: 'Membership inactive',
      expiry: 'Valid until',
      refresh: 'Refresh data',
      generateToken: 'Generate new code',
      lastSynced: 'Last synced',
      offlineToken: 'Offline codes',
      tokenHistory: 'Code history',
      manageProfile: 'Edit profile',
      profileTitle: 'Member profile',
      saveProfile: 'Save changes',
      close: 'Close',
      saving: 'Saving…',
      phone: 'Phone',
      branchPreference: 'Preferred branch',
      successProfile: 'Profile updated successfully.',
    },
    validate: {
      heading: 'Validate code',
      instructions: 'Scan the QR code or enter the code manually.',
      placeholder: 'Enter membership code',
      submit: 'Validate',
    },
    stats: {
      heading: 'Statistics',
      summary: 'Performance overview',
      redemptions: 'Redemptions',
      newMembers: 'New members',
      activeTokens: 'Active codes',
      partnerUptake: 'Partner uptake',
    },
    technician: {
      heading: 'Technician console',
      members: 'Members',
      trusted: 'Trusted users',
      activeCount: 'Active members',
      pendingApprovals: 'Pending approvals',
      expiringAccess: 'Expiring soon',
    },
  },
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries.cs;
}
