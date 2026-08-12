/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
        },
        navy: {
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
        },
        surface: {
          bg: "#F7F8FC",
          light: "#F8FAFC",
          card: "#FFFFFF",
          sidebar: "#FAFAFD",
          muted: "#F1F5F9",
        },
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          light: "#EFF6FF",
        },
        dark: {
          900: "#0F172A",
          800: "#1F2937",
          700: "#374151",
          600: "#4B5563",
          500: "#6B7280",
        },
        border: {
          light: "#E2E8F0",
          DEFAULT: "#E2E8F0",
          strong: "#CBD5E1",
          subtle: "#F1F5F9",
        },
        danger: {
          DEFAULT: "#DC2626",
          hover: "#B91C1C",
          light: "#FEF2F2",
          border: "#FCA5A5",
        },
        success: {
          DEFAULT: "#16A34A",
          hover: "#15803D",
          light: "#F0FDF4",
          border: "#86EFAC",
        },
        warning: {
          DEFAULT: "#EA580C",
          hover: "#C2410C",
          light: "#FFF7ED",
          border: "#FDBA74",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)",
        cardHover: "0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)",
        modal: "0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)",
      },
    },
  },
  plugins: [],
};



