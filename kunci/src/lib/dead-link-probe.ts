import {
  PROBE_CONCURRENCY,
  PROBE_TIMEOUT_MS,
  reasonFor,
  verdictFromProbe,
  type UrlCheck,
} from './dead-links'

/**
 * Asking a host whether it is still there.
 *
 * A WebSocket is the only handle the browser gives us on this question. It reports a
 * failure for every host, including healthy ones, but it reports a failure the resolver
 * could not answer *far* faster than one a server refused, and that difference is the
 * answer. See `dead-links.ts` for the measurements.
 *
 * Nothing about the entry is sent. The probe opens a connection to the host and closes
 * it, and the route is not a secret: `/` on a WebSocket port is the path browsers use
 * for every such test.
 */

function probeHost(host: string): Promise<{ ms: number; reportedAlive: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const started = performance.now()
    let settled = false
    let socket: WebSocket | null = null

    const finish = (reportedAlive: boolean, timedOut = false) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      try {
        socket?.close()
      } catch {
        /* already closing */
      }
      resolve({ ms: Math.round(performance.now() - started), reportedAlive, timedOut })
    }

    const timer = window.setTimeout(() => finish(false, true), PROBE_TIMEOUT_MS)
    try {
      socket = new WebSocket(`wss://${host}/`)
      socket.onopen = () => finish(true)
      socket.onerror = () => finish(false)
      socket.onclose = (ev) => {
        // A close with a real code means the server answered, which is proof enough that
        // the name resolved even though the handshake was refused.
        finish(ev.code > 1006)
      }
    } catch {
      // Constructing the socket throws only for a bad url, which is on us, not the site.
      finish(false, true)
    }
  })
}

/** Check one host, once. */
export async function checkHost(host: string, now = Date.now()): Promise<UrlCheck> {
  const probe = await probeHost(host)
  const verdict = verdictFromProbe(probe)
  return {
    url: host,
    verdict,
    reason: reasonFor(verdict, probe.timedOut),
    ms: probe.ms,
    at: now,
  }
}

/**
 * Check a list of hosts, a few at a time.
 *
 * Deliberately serial-ish: this runs from the user's own machine, and hundreds of
 * simultaneous connections would look like an attack to the sites involved and would
 * starve the user's own browsing. `onDone` fires after each host so the page can show
 * progress instead of appearing frozen.
 */
export async function checkHosts(
  hosts: string[],
  onDone?: (done: number, total: number) => void,
): Promise<UrlCheck[]> {
  const out: UrlCheck[] = []
  let next = 0
  const now = Date.now()

  async function worker() {
    while (next < hosts.length) {
      const index = next++
      const host = hosts[index]
      let result: UrlCheck
      try {
        result = await checkHost(host, now)
      } catch {
        // A probe that throws is a probe that proved nothing.
        result = { url: host, verdict: 'unclear', reason: 'blocked', at: now }
      }
      out[index] = result
      onDone?.(out.filter(Boolean).length, hosts.length)
    }
  }

  const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, hosts.length) }, worker)
  await Promise.all(workers)
  return out
}
