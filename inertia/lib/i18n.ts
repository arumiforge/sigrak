import { usePage } from '@inertiajs/react'

type Values = Record<string, string | number>

/**
 * Looks up a UI string sent by the server from resources/lang/id (keys
 * in English, copy in Indonesian) and fills {placeholders}. A missing
 * key shows the key itself, so gaps are easy to spot.
 */
export function translate(messages: Record<string, string>, key: string, values?: Values) {
  const message = messages[key]
  if (message === undefined) {
    return key
  }
  if (!values) {
    return message
  }
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  )
}

export function useT() {
  const { messages } = usePage().props
  return (key: string, values?: Values) => translate(messages, key, values)
}
