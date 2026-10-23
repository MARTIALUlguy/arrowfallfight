/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export statique 100 % : aucun backend, déployable tel quel sur Vercel.
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
