/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // HABITAT TRACE design tokens — clear, minimalistic light telemetry theme.
      colors: {
        canvas: "#f8fafc",
        foreground: "#0f172a",
        secondary: "#334155",
        muted: "#64748b",
        faint: "#94a3b8",
        surface: {
          DEFAULT: "#ffffff",
          elevated: "#ffffff",
          subtle: "#f1f5f9",
          hover: "#e2e8f0",
          card: "#ffffff",
        },
        border: {
          DEFAULT: "#e2e8f0",
          subtle: "#f1f5f9",
          strong: "#cbd5e1",
          rim: "#e2e8f0",
        },
        accent: {
          DEFAULT: "#0284c7",
          secondary: "#0369a1",
          hover: "#0369a1",
          light: "#0ea5e9",
          soft: "rgba(2, 132, 199, 0.08)",
        },
        critical: {
          DEFAULT: "#dc2626",
          strong: "#b91c1c",
          soft: "rgba(220, 38, 38, 0.08)",
        },
        telemetry: {
          co2: "#0284c7",
          rad: "#d97706",
          temp: "#ea580c",
          humidity: "#0891b2",
          pressure: "#059669",
          bio: "#0284c7",
        },
      },
      fontFamily: {
        sans: [
          '"Inter"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "8px",
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "14px",
        "3xl": "16px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04)",
        elevated: "0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)",
        glow: "0 1px 2px rgba(2, 132, 199, 0.12)",
        "glow-amber": "0 1px 2px rgba(217, 119, 6, 0.12)",
        "glow-red": "0 1px 2px rgba(220, 38, 38, 0.12)",
      },
    },
  },
  plugins: [],
};
