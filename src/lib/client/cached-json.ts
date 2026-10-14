/** Short-lived, bounded memory cache for public read-only JSON snapshots.
 * Never use for user-specific reads or writes. Full URLs include all filters.
 */
const MAX_ENTRIES = 64;
const snapshots = new Map<string, { data: unknown; expiresAt: number }>();
interface RequestEntry {
  controller: AbortController;
  promise: Promise<unknown>;
  consumers: number;
}
const requests = new Map<string, RequestEntry>();

export function clearJsonSnapshots(): void {
  snapshots.clear();
}

export function fetchCachedJson<T>(url: string, options: { signal?: AbortSignal; maxAgeMs?: number } = {}): Promise<T> {
  const { signal, maxAgeMs = 30_000 } = options;
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const snapshot = snapshots.get(url);
  if (snapshot && snapshot.expiresAt > Date.now()) {
    snapshots.delete(url);
    snapshots.set(url, snapshot);
    return Promise.resolve(snapshot.data as T);
  }
  snapshots.delete(url);

  let request = requests.get(url);
  if (!request || request.controller.signal.aborted) {
    const controller = new AbortController();
    const entry: RequestEntry = { controller, consumers: 0, promise: Promise.resolve() };
    entry.promise = fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}: Failed to load data`);
        if (!controller.signal.aborted) {
          snapshots.set(url, { data, expiresAt: Date.now() + maxAgeMs });
          if (snapshots.size > MAX_ENTRIES) snapshots.delete(snapshots.keys().next().value!);
        }
        return data;
      })
      .finally(() => { if (requests.get(url) === entry) requests.delete(url); });
    requests.set(url, entry);
    request = entry;
  }

  const shared = request;
  shared.consumers++;
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', abort);
      if (--shared.consumers === 0 && requests.get(url) === shared) shared.controller.abort();
      return true;
    };
    const abort = () => { if (finish()) reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    shared.promise.then(
      (data) => { if (finish()) resolve(data as T); },
      (error: unknown) => { if (finish()) reject(error); },
    );
  });
}
