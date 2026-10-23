import { Fraunces, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from 'next/font/google';

// All four fonts are downloaded at build time and served by the app itself,
// so nothing is fetched from Google while the app runs.

/** English headings. */
export const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

/** English body text, numbers and buttons. */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

// The Urdu fonts are not preloaded: a browser only downloads them once Urdu
// text is on screen, so English pages stay light on slow connections.

/** Urdu headings only. */
export const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['500', '700'],
  variable: '--font-nastaliq',
  display: 'swap',
  preload: false,
});

/** Urdu body text. */
export const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-naskh',
  display: 'swap',
  preload: false,
});

export const fontVariables = [fraunces.variable, jakarta.variable, nastaliq.variable, naskh.variable].join(' ');
