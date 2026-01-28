import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Leona - Primária
        primary: {
          DEFAULT: "#3A1D7A",
          light: "#5B3FA6",
          lighter: "#8E7EEA",
          lightest: "#C6BEF5",
          foreground: "#FFFFFF",
        },
        // Neutros
        background: "#F8F9FC",
        surface: "#FFFFFF",
        border: "#E5E7F2",
        text: {
          primary: "#1F1F2E",
          secondary: "#6B6F8D",
        },
        // Cores de status
        success: {
          DEFAULT: "#10B981",
          light: "#D1FAE5",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
        },
        error: {
          DEFAULT: "#EF4444",
          light: "#FEE2E2",
        },
        info: {
          DEFAULT: "#3B82F6",
          light: "#DBEAFE",
        },
      },
      boxShadow: {
        card: "0 6px 18px rgba(90, 63, 166, 0.08)",
        "card-hover": "0 8px 24px rgba(90, 63, 166, 0.12)",
        button: "0 4px 12px rgba(58, 29, 122, 0.25)",
      },
      backgroundImage: {
        "gradient-leona": "linear-gradient(135deg, #3A1D7A, #5B3FA6, #8E7EEA)",
        "gradient-leona-subtle": "linear-gradient(135deg, #C6BEF5, #8E7EEA)",
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
