import { useEffect, useRef, useState } from 'react'
import { Transmit } from '@adonisjs/transmit-client'
import { v4 as uuidv4 } from 'uuid'

/** State of the live connection, shown next to live content. */
export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'failed'

let client: Transmit | null = null
/** Fires `subscribed:<channel>` after every (re)subscription, and `failed`. */
const events = new EventTarget()

/**
 * Subscribing is a POST, so it carries the CSRF token like Inertia's
 * own requests do (the XSRF-TOKEN cookie sent back as a header).
 */
function withXsrf(request: Request) {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='))
  if (cookie) {
    request.headers.set('X-XSRF-TOKEN', decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)))
  }
}

/** One SSE connection per tab, shared by every subscription. */
function transmit() {
  if (!client) {
    client = new Transmit({
      baseUrl: window.location.origin,
      // The default uses crypto.randomUUID(), which needs a secure context.
      uidGenerator: () => uuidv4(),
      beforeSubscribe: withXsrf,
      beforeUnsubscribe: withXsrf,
      maxReconnectAttempts: 10,
      onSubscription: (channel) => events.dispatchEvent(new Event(`subscribed:${channel}`)),
      onSubscribeFailed: () => events.dispatchEvent(new Event('failed')),
      onReconnectFailed: () => events.dispatchEvent(new Event('failed')),
    })
  }
  return client
}

/**
 * Listens to a Transmit channel while the component is mounted.
 * `onReady` runs after every (re)subscription, including after a lost
 * connection comes back, so the caller can fetch what it missed.
 */
export function useChannel<Message>(
  channel: string,
  onMessage: (message: Message) => void,
  onReady?: () => void
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const handlers = useRef({ onMessage, onReady })
  useEffect(() => {
    handlers.current = { onMessage, onReady }
  })

  useEffect(() => {
    const instance = transmit()
    const subscription = instance.subscription(channel)
    const stop = subscription.onMessage<Message>((message) => handlers.current.onMessage(message))

    const onSubscribed = () => {
      setStatus('live')
      handlers.current.onReady?.()
    }
    const onFailed = () => setStatus('failed')
    const onReconnecting = () => setStatus('reconnecting')

    events.addEventListener(`subscribed:${channel}`, onSubscribed)
    events.addEventListener('failed', onFailed)
    instance.on('reconnecting', onReconnecting)
    void subscription.create()

    return () => {
      stop()
      events.removeEventListener(`subscribed:${channel}`, onSubscribed)
      events.removeEventListener('failed', onFailed)
      instance.off('reconnecting', onReconnecting)
      if (subscription.handlerCount === 0) {
        void subscription.delete()
      }
    }
  }, [channel])

  return status
}
