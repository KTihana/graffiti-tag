export const PERSONAL_APP_VERSION = '1.0.8';
export const RELEASES_URL = 'https://github.com/KTihana/graffiti-tag/releases';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/KTihana/graffiti-tag/releases/latest';
export type AppRelease = { version: string; downloadUrl: string; notes: string };

export function isNewerVersion(candidate: string, installed: string): boolean {
  const parse = (value: string) => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null;
  const next = parse(candidate), current = parse(installed);
  if (!next || !current) return false;
  for (let i = 0; i < 3; i++) {
    if (next[i] !== current[i]) return next[i] > current[i];
  }
  return false;
}
export function parseRelease(data: unknown): AppRelease {
  const release = data as { draft?: boolean; prerelease?: boolean; tag_name?: string; body?: string; assets?: { name?: string; browser_download_url?: string }[] } | null;
  const match = release?.tag_name?.match(/^v(\d+\.\d+\.\d+)-personal$/);
  if (!release || release.draft || release.prerelease || !match || !Array.isArray(release.assets)) throw new Error('No compatible Android release was found.');
  const expected = `${RELEASES_URL}/download/${release.tag_name}/graffiti-tag-personal.apk`;
  const asset = release.assets.find((item) => item.name === 'graffiti-tag-personal.apk' && item.browser_download_url === expected);
  if (!asset) throw new Error('The latest Android download is not ready yet. Try again later.');
  return { version: match[1], downloadUrl: expected, notes: typeof release.body === 'string' ? release.body : '' };
}
export async function fetchLatestRelease(): Promise<AppRelease> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('GitHub could not check for updates. Try again later.');
    return parseRelease(await response.json());
  } finally { clearTimeout(timer); }
}
