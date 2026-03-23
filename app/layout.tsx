import './global.css';
import type { Metadata } from 'next';
import { pressStart2P } from './fonts';

export const metadata: Metadata = {
  title:       'Sovereign States Militia | SSM',
  description: 'City-17 Roblox rebel community - Join the Sovereign States Militia in the fight for freedom.',
  keywords:    ['Roblox', 'City-17', 'rebel community', 'Sovereign States Militia', 'SSM', 'gaming community', 'roleplay'],
  authors:     [{ name: 'Zirconium' }],
  openGraph: {
    title:       'Sovereign States Militia | SSM',
    description: 'City-17 Roblox rebel community - Join the Sovereign States Militia in the fight for freedom.',
    type:        'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pressStart2P.variable}>
      <head>
        <link rel="preload" href="/SsPepHc3.png" as="image" />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}