import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'HexTorq Cloud Console', description: 'Managed deployment console' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
