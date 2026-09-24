import { getCloudflareContext } from '@opennextjs/cloudflare';
export async function env(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as CloudflareEnv;
}
