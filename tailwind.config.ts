import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Primary - usado apenas como acento
        primary: {
          DEFAULT: '#3A1D7A',
          light: '#5B3FA6',
          lighter: '#8E7EEA',
          lightest: '#C6BEF5',
        },
        // Neutros
        surface: '#FFFFFF',
        background: '#F8F9FC',
        muted: '#EEF0F6',
        border: '#E5E7F2',
        // Texto
        foreground: '#1F1F2E',
        'foreground-muted': '#6B6F8D',
        // Status
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(58,29,122,0.06)',
        'card-hover': '0 1px 3px rgba(0,0,0,0.04), 0 12px 32px rgba(58,29,122,0.10)',
        'button': '0 1px 2px rgba(0,0,0,0.05)',
        'input': '0 1px 2px rgba(0,0,0,0.04)',
        'dropdown': '0 4px 24px rgba(0,0,0,0.12)',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],
      },
    },
  },
  plugins: [],
};

export default config;
