import { cn } from '~/lib/utils'

/**
 * HTML from the safe Markdown renderer (app/publishing/markdown.ts):
 * every input character was escaped first and the output passed an
 * allowlist of a few tags, so it may be set as HTML here.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn('rich-text', className)}
      // Safe by construction: escaped input plus the allowlist sanitiser.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
