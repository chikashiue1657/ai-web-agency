import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f2ff",
          100: "#e8e3ff",
          500: "#6d28d9",
          600: "#5b21b6",
          700: "#4c1d95",
        },
      },
    },
  },
  plugins: [],
};

export default config;
