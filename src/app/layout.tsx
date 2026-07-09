import type { Metadata } from 'next';
import { JetBrains_Mono, Inter, IBM_Plex_Serif } from 'next/font/google';
import Nav from '@/components/Nav';
import './globals.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'MACRO STACK — Crypto Research Terminal',
  description: 'Institutional-grade crypto research terminal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${inter.variable} ${plexSerif.variable}`}>
      <body className="font-[var(--font-body)] antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
