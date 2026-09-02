import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Big Walk Club — Live island activities',
  description: 'Track live Big Walk routes, steps, distance and game progress.',
  openGraph: {
    title: 'Big Walk Club',
    description: 'Live island activities — routes, steps, distance and game progress.',
    images: [{ url: '/og.png', width: 1714, height: 909, alt: 'Big Walk Club live island activities' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Big Walk Club',
    description: 'Live island activities — routes, steps, distance and game progress.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
