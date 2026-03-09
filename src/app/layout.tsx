import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import Nav from '@/components/Nav';
import './globals.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'MACRO STACK — Decision Engine',
  description: 'Institutional-grade crypto & FTMO macro trading dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${outfit.variable}`}>
      <body className="font-[var(--font-outfit)] antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
