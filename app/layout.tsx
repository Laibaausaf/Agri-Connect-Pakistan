import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { fontVariables } from './fonts';
import { LanguageProvider } from '@/components/i18n/LanguageProvider';
import { ThemeProvider } from '@/components/layout/ThemeToggle';
import { getI18n } from '@/lib/i18n/server';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';

// Browser tab title in the chosen language.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const i18n = await getI18n();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  // Language, direction and theme are set on <html> by the server, so the
  // first paint is already right (no flash of the wrong theme or direction).
  return (
    <html lang={i18n.lang} dir={i18n.dir} data-theme={theme} className={fontVariables}>
      <body className="min-h-screen antialiased">
        <LanguageProvider lang={i18n.lang}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
