import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import Providers from '@/components/yoisho/Providers';

// Fonts load from Google Fonts at runtime (not at build time), so builds never fail offline
// and the UI falls back to system Japanese fonts if the network is unavailable.
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@500;700;800&display=swap';

export const metadata: Metadata = {
  title: 'Yoisho Learn — Adaptive Kanji Studio',
  description: 'Learn Japanese kanji with spaced repetition that adapts to what you are about to forget.',
  keywords: ['Japanese', 'Kanji', 'JLPT', 'Spaced repetition', 'Yoisho Academy'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFECE3' },
    { media: '(prefers-color-scheme: dark)', color: '#131210' },
  ],
};

// Applies the saved theme before first paint so there is no light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('yoisho_theme');if(!t){var s=JSON.parse(localStorage.getItem('yoisho_learn_state_v3')||'{}');t=(s.settings&&s.settings.theme)||'system'}if(t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
