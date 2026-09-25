import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  // Build id baked into client and server, so an old cached app can notice a new deploy and reload itself.
  env: { NEXT_PUBLIC_BUILD: (process.env.GITHUB_SHA ?? '').slice(0, 7) || String(Date.now()) },
};
export default nextConfig;

initOpenNextCloudflareForDev();
