import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { QueueName } from '#config/queue'

const queueNames: QueueName[] = ['ai', 'exports', 'default']

/**
 * The worker process roles of D-388: `queue:work ai` is `worker-ai`,
 * `queue:work exports` is `worker-exports`, `queue:work default` is
 * `worker-default`. One process per container; replicas scale it.
 */
export default class QueueWork extends BaseCommand {
  static commandName = 'queue:work'
  static description =
    'Run the worker of one queue (process roles worker-ai, worker-exports, worker-default)'

  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  @args.string({ description: 'Queue to work: ai, exports or default' })
  declare queue: string

  async run() {
    if (!queueNames.includes(this.queue as QueueName)) {
      this.logger.error(`Unknown queue "${this.queue}". Use one of: ${queueNames.join(', ')}`)
      this.exitCode = 1
      return this.terminate()
    }

    const { startWorker } = await import('#services/queue/worker')
    const handle = await startWorker(this.queue as QueueName)

    this.app.terminating(async () => {
      this.logger.info(`worker-${this.queue}: stopping`)
      await handle.close()
    })
    // SIGTERM is wired in bin/console.ts; Ctrl+C in development stops the same way.
    process.once('SIGINT', () => this.app.terminate())

    this.logger.success(`worker-${this.queue}: ready (pid ${process.pid})`)
  }
}
