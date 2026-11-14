/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // DESIGN.md palette. Neutral ramp (surface/border steps) is foreground
      // composited on the pitch-black canvas at fixed alpha, so the UI stays
      // monochrome; hue is reserved for interaction and critical alerts.
      colors: {
        canvas: "#000000",
        foreground: "#ffffff",
        secondary: "#a3a3a3",
        muted: "#737373",
        faint: "#525252",
        surface: {
          DEFAULT: "#0a0a0a",
          elevated: "#101010",
          subtle: "#161616",
          hover: "#1c1c1c",
        },
        border: {
          DEFAULT: "#242424",
          subtle: "#1c1c1c",
          strong: "#3a3a3a",
        },
        accent: {
          DEFAULT: "#000000",
          secondary: "#0026a3",
          hover: "#0034c4",
          light: "#8b9dff",
          soft: "rgba(0, 38, 163, 0.18)",
        },
        critical: {
          DEFAULT: "#f87171",
          strong: "#e5484d",
          soft: "rgba(229, 72, 77, 0.12)",
        },
      },
      fontFamily: {
        sans: [
          "'JetBrains Mono'",
          "Consolas",
          "'Liberation Mono'",
          "Menlo",
          "monospace",
        ],
        mono: [
          "'JetBrains Mono'",
          "Consolas",
          "'Liberation Mono'",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "8px",
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "8px",
        xl: "8px",
        "2xl": "8px",
        "3xl": "8px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255, 255, 255, 0.03)",
        elevated: "0 16px 40px -12px rgba(0, 0, 0, 0.8)",
      },
    },
  },
  plugins: [],
};
