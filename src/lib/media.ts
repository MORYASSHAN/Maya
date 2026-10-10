/**
 * Checks whether an optional media file has been dropped into /public/media.
 * SPA dev servers answer unknown paths with index.html, so match on content-type.
 */
const cache = new Map<string, Promise<boolean>>()

export function mediaExists(url: string, kind: 'video' | 'image') {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { method: 'HEAD' })
        .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith(kind))
        .catch(() => false),
    )
  }
  return cache.get(url)!
}
