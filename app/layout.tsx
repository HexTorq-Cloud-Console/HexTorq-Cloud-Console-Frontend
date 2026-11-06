import './globals.css';
import './tokens.css';
import './components.css';
import './auth.css';
import './shell.css';
import './overview.css';
import './services.css';
import './deployments.css';
import './pm2.css';
import './health.css';
import './access-alerts.css';
import './admin.css';
import './states.css';
import './enhancements.css';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = { title: 'HexTorq Cloud Console', description: 'Managed deployment console' };

export const viewport: Viewport = { themeColor: '#f5f5f2', colorScheme: 'light dark' };

const themeBoot = `(function(){try{var theme=window.localStorage.getItem('hextorq-theme');document.documentElement.dataset.theme=theme==='dark'?'dark':'light';}catch(error){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {children}
      </body>
    </html>
  );
}
