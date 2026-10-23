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

/**
 * The same English font for Latin text inside Urdu pages (names, deal numbers,
 * amounts). It has no fallback of its own, so a letter it lacks, every Urdu
 * letter, goes straight to the Urdu font next in the stack, never to a system
 * font such as Arial.
 */
export const jakartaLatin = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta-latin',
  display: 'swap',
  adjustFontFallback: false,
  fallback: [],
  preload: false,
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

export const fontVariables = [fraunces.variable, jakarta.variable, jakartaLatin.variable, nastaliq.variable, naskh.variable].join(' ');
