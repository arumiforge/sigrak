import { useId, useState } from 'react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { RichText } from '~/components/publishing/rich_text'
import { useT } from '~/lib/i18n'
import { renderMarkdown } from '~/lib/markdown'
import { cn } from '~/lib/utils'

/**
 * The body of a Kabar, Acara, Cerita Sekolah or legal page: Markdown in
 * a text area, with a preview rendered by the same safe renderer the
 * server uses. Phones switch between "Tulis" and "Pratinjau"; from
 * 1024 px both sit side by side.
 */
export function MarkdownEditor({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  optionalLabel,
  rows = 14,
  disabled = false,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  optionalLabel?: string
  rows?: number
  disabled?: boolean
}) {
  const t = useT()
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const tabsId = useId()
  const html = renderMarkdown(value)

  const tabButton = (key: 'write' | 'preview', text: string) => (
    <button
      type="button"
      role="tab"
      id={`${tabsId}-${key}`}
      aria-selected={tab === key}
      aria-controls={`${tabsId}-${key}-panel`}
      onClick={() => setTab(key)}
      className={cn(
        'min-h-11 rounded-md px-4 text-sm font-semibold',
        tab === key ? 'bg-brand-tint text-brand-strong' : 'text-muted hover:bg-surface-hover'
      )}
    >
      {text}
    </button>
  )

  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label={t('publishing.editor.tabs_label')}
        className="flex gap-1 lg:hidden"
      >
        {tabButton('write', t('publishing.editor.write'))}
        {tabButton('preview', t('publishing.editor.preview'))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          id={`${tabsId}-write-panel`}
          className={cn(tab === 'write' ? 'block' : 'hidden', 'lg:block')}
        >
          <FormField
            label={label}
            hint={hint ?? t('publishing.editor.hint')}
            error={error}
            optionalLabel={optionalLabel}
          >
            {(field) => (
              <textarea
                {...field}
                name={name}
                rows={rows}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className={cn(controlClass, 'py-2 font-mono text-sm leading-relaxed')}
              />
            )}
          </FormField>
        </div>
        <div
          id={`${tabsId}-preview-panel`}
          aria-label={t('publishing.editor.preview')}
          className={cn(
            tab === 'preview' ? 'block' : 'hidden',
            'min-w-0 rounded-md border bg-page p-4 lg:block'
          )}
        >
          <p className="mb-3 hidden text-sm font-semibold text-muted lg:block">
            {t('publishing.editor.preview')}
          </p>
          {value.trim() === '' ? (
            <p className="text-sm text-muted">{t('publishing.editor.preview_empty')}</p>
          ) : (
            <RichText html={html} />
          )}
        </div>
      </div>
    </div>
  )
}
