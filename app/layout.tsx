import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Sandbars - Surf Forecast',
  description: 'Customizable surf forecasting for your favorite spots',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className}`}>
        <AuthProvider>
          <PreferencesProvider>{children}</PreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
