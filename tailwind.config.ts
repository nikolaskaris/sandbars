import type { Config } from "tailwindcss";

/**
 * Sandbars Design System — Tailwind Config
 *
 * All tokens trace back to DESIGN-BRIEF.md.
 * Palette: warm sand/beige base, muted terracotta accent, data provides all saturated color.
 * Typography: Inter, 400/500 weights only, 14px base.
 * Geometry: 4px grid, minimal radius (4-6px), warm shadows.
 */

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // -------------------------------------------------------------------------
    // Font Size — constrained scale, 14px base for data-dense app
    // -------------------------------------------------------------------------
    fontSize: {
      xs: ["0.6875rem", { lineHeight: "1.4" }],     // 11px
      sm: ["0.8125rem", { lineHeight: "1.5" }],     // 13px
      base: ["0.875rem", { lineHeight: "1.6" }],    // 14px
      lg: ["1rem", { lineHeight: "1.5" }],           // 16px
      xl: ["1.25rem", { lineHeight: "1.3" }],        // 20px
      "2xl": ["1.5rem", { lineHeight: "1.2" }],     // 24px
      "3xl": ["2rem", { lineHeight: "1.2" }],        // 32px
    },

    // -------------------------------------------------------------------------
    // Border Radius — geometric, minimal. 4-6px, not 12-16px.
    // -------------------------------------------------------------------------
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "6px",
      lg: "8px",
      full: "9999px", // pill badges only
    },

    // -------------------------------------------------------------------------
    // Box Shadow — warm-toned, subtle, physical
    // -------------------------------------------------------------------------
    boxShadow: {
      none: "none",
      sm: "0 1px 3px rgba(60, 50, 40, 0.06), 0 1px 2px rgba(60, 50, 40, 0.04)",
      DEFAULT: "0 2px 8px rgba(60, 50, 40, 0.08), 0 1px 3px rgba(60, 50, 40, 0.04)",
      md: "0 2px 8px rgba(60, 50, 40, 0.08), 0 1px 3px rgba(60, 50, 40, 0.04)",
      lg: "0 4px 16px rgba(60, 50, 40, 0.10), 0 2px 6px rgba(60, 50, 40, 0.05)",
    },

    extend: {
      // -----------------------------------------------------------------------
      // Colors
      // -----------------------------------------------------------------------
      colors: {
        // Backgrounds — warm off-white to sand
        background: "#FAF8F5",
        surface: {
          DEFAULT: "#FEFDFB",
          secondary: "#F5F0E8",
          map: "#EDE7DC",
        },

        // Borders — warm gray, NOT cool gray
        border: {
          DEFAULT: "#E0D8CC",
          strong: "#C9BFB0",
        },

        // Text hierarchy — warm near-black, never pure black or cool gray
        text: {
          primary: "#2C2825",
          secondary: "#8C8279",
          tertiary: "#B5ADA4",
        },

        // Accent — terracotta options (3 families)
        // Option A: Dusty/muted
        "accent-dusty": {
          DEFAULT: "#C4856C",
          hover: "#B5755C",
          muted: "#F3E8E2",
        },
        // Option B: Warm/medium (recommended default)
        accent: {
          DEFAULT: "#B8704C",
          hover: "#A5623F",
          muted: "#F2E4DA",
        },
        // Option C: Earthy/brown-leaning
        "accent-earthy": {
          DEFAULT: "#A66B4F",
          hover: "#955E43",
          muted: "#EFE2D9",
        },

        // Data visualization — swell height (gray → blue)
        "data-swell": {
          low: "#B5ADA4",
          mid: "#6B9AC4",
          high: "#1E3A6E",
        },

        // Data visualization — swell period (gray → purple)
        "data-period": {
          low: "#B5ADA4",
          mid: "#9B7FBF",
          high: "#4A2D73",
        },

        // Data visualization — wind speed (gray → teal)
        "data-wind": {
          low: "#B5ADA4",
          mid: "#5BA8A0",
          high: "#1B6B62",
        },

        // Quality score — poor → fair → good → epic
        quality: {
          poor: "#C47A6C",
          fair: "#C9A96E",
          good: "#7BA882",
          epic: "#3A7F7A",
        },

        // Status — semantic, muted per brief
        success: "#7BA882",
        warning: "#C9A96E",
        error: "#C47A6C",
      },

      // -----------------------------------------------------------------------
      // Font Family — Inter loaded via next/font in layout.tsx
      // -----------------------------------------------------------------------
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },

      // -----------------------------------------------------------------------
      // Font Weight — 400 + 500 only. No semibold/bold in this design system.
      // -----------------------------------------------------------------------
      fontWeight: {
        normal: "400",
        medium: "500",
      },

      // -----------------------------------------------------------------------
      // Letter Spacing
      // -----------------------------------------------------------------------
      letterSpacing: {
        tight: "-0.01em",
        normal: "0em",
      },

      // -----------------------------------------------------------------------
      // Line Height — body (relaxed), headings (tight), data (tabular)
      // -----------------------------------------------------------------------
      lineHeight: {
        data: "1.3",
        body: "1.6",
        heading: "1.2",
      },

      // -----------------------------------------------------------------------
      // Transitions — quick, physical, purposeful
      // -----------------------------------------------------------------------
      transitionDuration: {
        DEFAULT: "150ms",
        fast: "100ms",
        layout: "200ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease-out",
        layout: "ease-in-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
