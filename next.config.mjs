/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the same build deploys to Vercel or GitHub Pages.
  output: "export",
  images: { unoptimized: true },
  // For GitHub Pages project sites, set NEXT_PUBLIC_BASE_PATH=/where-is-derek at build time.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
