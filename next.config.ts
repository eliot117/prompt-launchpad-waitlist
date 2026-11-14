import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["3000-" + (process.env.BASE44_PUBLIC_HOST_SUFFIX ?? "")].filter(
    (o) => o !== "3000-",
  ),
};

export default nextConfig;
