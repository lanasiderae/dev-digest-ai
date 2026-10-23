import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The hermetic stack runs beside dev from this same checkout. Sharing
  // .next would let its compiled API URL (:3101) leak into the dev browser.
  distDir: process.env.E2E_FIXTURES === "1" ? ".next-e2e" : ".next",
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001",
  },
};

export default withNextIntl(nextConfig);
