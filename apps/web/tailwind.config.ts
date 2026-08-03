import type { Config } from "tailwindcss";

/**
 * Design tokens inlined here (rather than imported as a package subpath)
 * to keep the Next.js config-loading path dependency-free — see
 * packages/config/tailwind-preset.ts for the canonical, documented source
 * of these values (Design System §2–4); keep both in sync if either changes.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        border: "hsl(var(--border))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        info: "hsl(var(--info))"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"]
      },
      spacing: {
        18: "4.5rem"
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem"
      },
      transitionDuration: {
        micro: "140ms",
        panel: "200ms"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
