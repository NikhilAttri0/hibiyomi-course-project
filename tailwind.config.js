/** @type {import('tailwindcss').Config} */

// Every colour is a CSS variable holding an "R G B" triple (see src/styles/globals.css),
// so light/dark themes switch by changing variables and opacity modifiers like bg-brand/10 still work.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        paper: v('paper'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
        line: v('line'),
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), soft: v('brand-soft'), ink: v('brand-ink') },
        sumi: v('sumi'),
        matcha: { DEFAULT: v('matcha'), soft: v('matcha-soft') },
        sakura: { DEFAULT: v('sakura'), soft: v('sakura-soft') },
        ai: { DEFAULT: v('ai'), soft: v('ai-soft') },
        kin: { DEFAULT: v('kin'), soft: v('kin-soft') },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'var(--font-jp)', 'system-ui', 'sans-serif'],
        jp: ['var(--font-jp)', '"Hiragino Kaku Gothic ProN"', '"Noto Sans JP"', 'sans-serif'],
        mincho: ['var(--font-mincho)', '"Hiragino Mincho ProN"', '"Yu Mincho"', 'serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.04), 0 4px 16px -4px rgb(var(--shadow) / 0.08)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.06), 0 18px 40px -12px rgb(var(--shadow) / 0.22)',
        brand: '0 10px 30px -10px rgb(var(--brand) / 0.65)',
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(.94)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shake: { '0%,100%': { transform: 'none' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
        drift: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .3s cubic-bezier(.2,.7,.2,1) both',
        shake: 'shake .35s ease-in-out',
        drift: 'drift 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
