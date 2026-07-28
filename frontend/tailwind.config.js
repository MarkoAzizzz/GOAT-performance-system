/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware neutrals — driven by CSS custom properties that flip
        // per [data-theme] in index.css. Accent colors stay constant across
        // themes (brand identity), so they remain plain hex.
        coal: 'rgb(var(--c-bg-base) / <alpha-value>)',
        surface: 'rgb(var(--c-bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-bg-elevated) / <alpha-value>)',
        'input-bg': 'rgb(var(--c-bg-input) / <alpha-value>)',
        sidebar: 'rgb(var(--c-bg-sidebar) / <alpha-value>)',
        'off-white': 'rgb(var(--c-text-primary) / <alpha-value>)',
        'steel-gray': 'rgb(var(--c-text-secondary) / <alpha-value>)',
        overlay: 'rgb(var(--c-overlay) / <alpha-value>)',
        'blood-red': '#E11919',
        'blood-dark': '#B90F16',
        'blood-deep': '#7C0D12',
      },
      fontFamily: {
        display: ['Impact', 'Haettenschweiler', 'Arial Narrow', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'combat-grid': `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'combat-grid': '40px 40px',
      },
      boxShadow: {
        'red-glow': '0 0 20px rgba(225, 25, 25, 0.15)',
        'red-glow-lg': '0 0 40px rgba(225, 25, 25, 0.2)',
      },
    },
  },
  plugins: [],
}
