import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Psychočas - členská aplikace / member app',
    short_name: 'Psychočas',
    description: 'Členství, partnerské výhody a bezpečné ověření slev. Membership, benefits, and secure verification.',
    start_url: '/home?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f8fb',
    theme_color: '#1d4f7d',
    orientation: 'portrait-primary',
    lang: 'cs-CZ',
    categories: ['education', 'lifestyle', 'utilities'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/faviconV1.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/faviconV2.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
