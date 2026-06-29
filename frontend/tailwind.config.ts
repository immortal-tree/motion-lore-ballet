import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'Courier New', 'monospace'],
      },
      colors: {
        bg: '#0D0B0A',
        surface: '#161310',
        'surface-2': '#1C1916',
        border: '#2A2520',
        gold: '#D4A96A',
        'gold-dim': '#9A7A4A',
        cream: '#E8D9B8',
        'text-main': '#F5F0E8',
        muted: '#7A6E64',
        'muted-2': '#4A4440',
      },
    },
  },
  plugins: [],
}
export default config
