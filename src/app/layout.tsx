import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { WebVitals } from '@/components/telemetry/WebVitals';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Straits',
  description: 'Real-time Middle East oil tanker tracking',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable}`}>
      <body className="bg-black text-white antialiased">
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
