import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        agri: {
          50: '#F2F7F4',
          100: '#E3F0E8',
          200: '#C5E1CE',
          300: '#9CCBAC',
          400: '#6EAF86',
          500: '#4A9464',
          600: '#38784F',
          700: '#2F5F41',
          800: '#294C36',
          900: '#1B4332',
          950: '#0F281E',
        },
        surface: '#F8F9F5',
        charcoal: '#2D3436',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
