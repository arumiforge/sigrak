import TransmitProvider from '@adonisjs/transmit/transmit_provider'

/**
 * The Transmit provider, shut down only when something used it.
 *
 * The package's provider resolves `transmit` inside `shutdown()`. In a
 * short-lived process that never used it (an ace command such as
 * migration:run), that opens the Redis transport only to close it at
 * once, and the transport's pending subscribe then crashes the process
 * with "Connection is closed".
 */
export default class SigrakTransmitProvider extends TransmitProvider {
  #resolved = false

  register() {
    super.register()
    this.app.container.resolving('transmit', () => {
      this.#resolved = true
    })
  }

  async shutdown() {
    if (this.#resolved) {
      await super.shutdown()
    }
  }
}
