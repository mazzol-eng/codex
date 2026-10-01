import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { CSSProperties } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { brand } from '../../../../config/brand';
import { Providers } from '@/components/providers';
import './globals.css';
const inter = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2',
      weight: '500',
    },
    {
      path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2',
      weight: '600',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
});
const jakarta = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2',
      weight: '600',
    },
    {
      path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2',
      weight: '700',
    },
    {
      path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2',
      weight: '800',
    },
  ],
  variable: '--font-jakarta',
  display: 'swap',
});
export const metadata: Metadata = {
  title: { default: `${brand.name} — Conversas que aproximam`, template: `%s | ${brand.name}` },
  description: 'Automatize seu atendimento no WhatsApp, Telegram e SMS, sem escrever código.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const colors = Object.fromEntries(
    Object.entries(brand.colors).map(([name, value]) => [`--brand-${name}`, value]),
  ) as CSSProperties;
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable}`}
      style={colors}
    >
      <body>
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
