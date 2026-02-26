import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cosmoffice - Your Office in the Cosmos',
  description: 'The next generation virtual office platform for remote teams. Move, meet, and collaborate in a spatial workspace that feels like a real office.',
  keywords: ['virtual office', 'remote work', 'collaboration', 'video conferencing', 'spatial workspace', 'team collaboration'],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-dark-bg text-slate-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
