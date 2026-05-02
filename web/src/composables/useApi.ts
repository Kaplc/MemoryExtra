const API_BASE = window.location.origin

export function useApi() {
  async function fetchJson<T>(url: string, retries = 3): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : API_BASE + url
    for (let i = 0; i < retries; i++) {
      try {
        const r = await fetch(fullUrl)
        if (!r.ok && r.status >= 500 && i < retries - 1) {
          await new Promise(res => setTimeout(res, 500))
          continue
        }
        return await r.json()
      } catch (e) {
        if (i < retries - 1) {
          await new Promise(res => setTimeout(res, 500))
          continue
        }
        throw e
      }
    }
    throw new Error('fetchJson: unreachable')
  }

  async function postJson<T>(url: string, body: any): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : API_BASE + url
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await r.json()
  }

  return { fetchJson, postJson, API_BASE }
}
