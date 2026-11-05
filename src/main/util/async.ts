export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const size = Math.max(1, Math.min(limit, items.length || 1))
  const runners = Array.from({ length: size }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index]!, index)
    }
  })
  await Promise.all(runners)
  return results
}

export function throttle<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let last = 0
  return ((...args: never[]) => {
    const now = Date.now()
    if (now - last >= waitMs) {
      last = now
      fn(...args)
    }
  }) as T
}

export class Semaphore {
  private active = 0
  private readonly queue: (() => void)[] = []

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active += 1
    try {
      return await task()
    } finally {
      this.active -= 1
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

export class CancelledError extends Error {
  constructor(message = 'Cancelled') {
    super(message)
    this.name = 'CancelledError'
  }
}
