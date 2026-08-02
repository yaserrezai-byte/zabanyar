import type { Metadata, Viewport } from 'next';
import './globals.css';
import InstallPrompt from '@/components/InstallPrompt';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'زبان‌یار | آموزش هوشمند زبان انگلیسی',
  description:
    'پلتفرم آموزش زبان انگلیسی مبتنی بر هوش مصنوعی برای فارسی‌زبانان — تعیین سطح تطبیقی، درس شخصی‌سازی‌شده، مربی هوشمند و تصحیح خودکار.',
  keywords: ['آموزش زبان انگلیسی', 'هوش مصنوعی', 'تعیین سطح', 'زبان‌یار'],
  authors: [{ name: 'Zabanyar' }],
  openGraph: {
    title: 'زبان‌یار | آموزش هوشمند زبان انگلیسی',
    description: 'یادگیری انگلیسی با مربی هوش مصنوعی فارسی‌زبان',
    locale: 'fa_IR',
    type: 'website',
  },

  // ---- PWA ----
  manifest: '/manifest.json',
  applicationName: 'زبان‌یار',
  appleWebApp: {
    capable: true,
    title: 'زبان‌یار',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#1d5cf5',
  width: 'device-width',
  initialScale: 1,
  // Let the shell fill the notch area when installed.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/*
          Next 16 emits the modern `mobile-web-app-capable` but no longer
          the legacy Apple variant, which iOS < 17 still needs to launch
          in standalone mode. Declared manually so older iPhones open the
          installed app without Safari chrome.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <ServiceWorkerRegistrar />
        <InstallPrompt />
      </body>
    </html>
  );
}
