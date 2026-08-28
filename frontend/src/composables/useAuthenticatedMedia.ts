import { ref } from 'vue'
import { getRequestHeaders } from '@/services/api'

/**
 * Fetch /api/media/{id} with auth cookies and X-Organization-ID so media works
 * when super-admins (or multi-org users) switch orgs. Plain <img src> cannot
 * send that header, so we load bytes via fetch() and expose blob: URLs.
 */
export function useAuthenticatedMedia() {
  const urls = ref<Record<string, string>>({})
  const failed = ref<Set<string>>(new Set())
  const pending = new Set<string>()

  function mediaEndpoint(messageId: string): string {
    const basePath = ((window as any).__BASE_PATH__ ?? '').replace(/\/$/, '')
    return `${basePath}/api/media/${messageId}`
  }

  async function prefetch(message: { id: string; media_url?: string }) {
    if (!message.media_url || urls.value[message.id] || pending.has(message.id)) return
    pending.add(message.id)
    try {
      const res = await fetch(mediaEndpoint(message.id), {
        credentials: 'include',
        headers: getRequestHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const next = { ...urls.value }
      next[message.id] = URL.createObjectURL(blob)
      urls.value = next
    } catch {
      failed.value = new Set([...failed.value, message.id])
    } finally {
      pending.delete(message.id)
    }
  }

  async function prefetchMany(messages: Array<{ id: string; media_url?: string }>) {
    await Promise.all(messages.map(m => prefetch(m)))
  }

  function resolve(messageId: string): string {
    return urls.value[messageId] || ''
  }

  function clear() {
    for (const url of Object.values(urls.value)) {
      URL.revokeObjectURL(url)
    }
    urls.value = {}
    failed.value = new Set()
    pending.clear()
  }

  function hasFailed(messageId: string): boolean {
    return failed.value.has(messageId)
  }

  return { urls, failed, prefetch, prefetchMany, resolve, hasFailed, clear, mediaEndpoint }
}
