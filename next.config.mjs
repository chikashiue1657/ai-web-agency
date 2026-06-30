/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 仮デモサイトで外部（Googleマップ由来）の画像を扱う余地を残す。
  // 実運用ではドメインを絞ること。
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
