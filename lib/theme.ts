/** Cookie that remembers the Light/Dark choice (per browser). Light by default. */
export const THEME_COOKIE = 'theme';

export type Theme = 'light' | 'dark';

export function parseTheme(value: string | undefined | null): Theme {
  return value === 'dark' ? 'dark' : 'light';
}
