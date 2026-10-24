import type { Config } from 'tailwindcss';

const config: Config = {
  // The header toggle sets data-theme="dark" on <html>.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens (app/globals.css); they switch with the theme.
        paper: 'var(--bg)',
        sf: 'var(--sf)',
        sage: 'var(--sg)',
        line: 'var(--ln)',
        forest: 'var(--fo)',
        ink: 'var(--ink)',
        muted: 'var(--mu)',
        gold: 'var(--gd)',
        ongold: 'var(--og)',
        goldtext: 'var(--gi)',
        side: 'var(--sd)',
        sidetext: 'var(--st)',
        ok: { bg: 'var(--okb)', fg: 'var(--okf)' },
        warn: { bg: 'var(--wab)', fg: 'var(--waf)' },
        err: { bg: 'var(--erb)', fg: 'var(--erf)' },
        info: { bg: 'var(--inb)', fg: 'var(--inf)' },
      },
      fontFamily: {
        sans: ['var(--fb)'],
        display: ['var(--fd)'],
      },
      borderRadius: {
        card: '22px',
        hero: '26px',
        btn: '16px',
        field: '14px',
      },
      boxShadow: {
        card: 'var(--sh)',
      },
      backgroundImage: {
        brand: 'var(--gr)',
      },
    },
  },
  plugins: [],
};

export default config;
