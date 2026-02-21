import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cosmoffice - Virtual Workspace',
  description: 'The next generation virtual office platform for remote teams',
  keywords: ['virtual office', 'remote work', 'collaboration', 'video conferencing'],
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
