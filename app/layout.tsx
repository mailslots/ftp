import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hello Vercel',
  description: 'A minimal Next.js app ready for Vercel deployment.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
