import redis from '@adonisjs/redis/services/main'
import env from '#start/env'

/**
 * Stops a running AI call when the teacher cancels. The web process
 * marks the generation cancelled in the database and publishes its id;
 * every `worker-ai` process aborts the call it runs for that id. Pub/sub
 * channels are shared by every Redis database, so the name carries the
 * environment.
 */
const channel = `sigrak:${env.get('NODE_ENV')}:generation-cancel`

/** Why a running step stops early. */
export type StopReason = 'cancelled' | 'shutdown'

const running = new Map<number, AbortController>()

export const cancellation = {
  /**
   * Registers a step that is about to call the AI; the returned signal
   * aborts on cancel or on worker shutdown.
   */
  track(generationId: number, parent?: AbortSignal) {
    const controller = new AbortController()
    parent?.addEventListener('abort', () => controller.abort('cancelled'), { once: true })
    running.set(generationId, controller)
    return {
      signal: controller.signal,
      reason: () => controller.signal.reason as StopReason | undefined,
      done: () => {
        if (running.get(generationId) === controller) running.delete(generationId)
      },
    }
  },

  abortLocal(generationId: number, reason: StopReason = 'cancelled') {
    running.get(generationId)?.abort(reason)
  },

  /** Aborts every running step of this process (worker shutdown). */
  abortAll(reason: StopReason) {
    for (const controller of running.values()) controller.abort(reason)
  },

  runningCount() {
    return running.size
  },

  async publish(generationId: number) {
    await redis.connection('ai').publish(channel, String(generationId))
  },

  /**
   * Listens for cancel messages; used by the worker of the `ai` queue.
   * Resolves once the subscription is in place.
   */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      redis
        .connection('ai')
        .subscribe(channel, (message: string) => this.abortLocal(Number(message), 'cancelled'), {
          onSubscription: () => resolve(),
          onError: reject,
        })
    })
  },

  async stopListening() {
    await redis.connection('ai').unsubscribe(channel)
  },
}
