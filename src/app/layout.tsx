import type { Metadata, Viewport } from 'next';
import './globals.css';

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
};

export const viewport: Viewport = {
  themeColor: '#1d5cf5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
