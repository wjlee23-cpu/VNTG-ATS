import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

const inter = Inter({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VNTG 채용 플랫폼',
  description: 'AI 기반 채용 관리 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          'font-sans antialiased text-neutral-900 dark:text-neutral-50',
        )}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
