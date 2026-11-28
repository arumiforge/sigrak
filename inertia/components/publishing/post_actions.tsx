import { useState } from 'react'
import { router } from '@inertiajs/react'
import { ConfirmDialog } from '~/components/patterns/confirm_dialog'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

/**
 * The buttons under a Kabar, Acara or Cerita Sekolah form. A new post
 * or a draft: "Simpan draf" and "Terbitkan". A published post: "Simpan
 * perubahan", "Tarik kembali" (back to draft) and the public link. A
 * draft can be removed ("Hapus draf"). Taking back and removing ask
 * first.
 */
export function PostActions({
  status,
  processing,
  onSave,
  baseUrl,
  publicUrl,
  canPublish = true,
}: {
  status: 'draft' | 'published' | null
  processing: boolean
  onSave: (publish: boolean) => void
  /** The post's console URL ("/kabar/12"), null while it is new. */
  baseUrl: string | null
  publicUrl?: string | null
  canPublish?: boolean
}) {
  const t = useT()
  const [confirm, setConfirm] = useState<'unpublish' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)

  const post = (suffix: 'tarik' | 'hapus') => {
    if (!baseUrl) return
    router.post(
      `${baseUrl}/${suffix}`,
      {},
      {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => {
          setBusy(false)
          setConfirm(null)
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
      {status === 'published' ? (
        <Button type="button" onClick={() => onSave(false)} disabled={processing}>
          {t('publishing.form.save')}
        </Button>
      ) : (
        <>
          {canPublish && (
            <Button type="button" onClick={() => onSave(true)} disabled={processing}>
              {t('publishing.form.publish')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onSave(false)}
            disabled={processing}
          >
            {t('publishing.form.save_draft')}
          </Button>
        </>
      )}
      {publicUrl && (
        <Button asChild variant="ghost">
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={18} />
            {t('publishing.form.public_link')}
          </a>
        </Button>
      )}
      <div className="hidden flex-1 sm:block" />
      {baseUrl && status === 'published' && (
        <Button type="button" variant="outline" onClick={() => setConfirm('unpublish')}>
          {t('publishing.form.unpublish')}
        </Button>
      )}
      {baseUrl && status === 'draft' && (
        <Button type="button" variant="ghost" onClick={() => setConfirm('delete')}>
          <Icon name="delete" size={18} />
          {t('publishing.form.delete')}
        </Button>
      )}

      <ConfirmDialog
        open={confirm === 'unpublish'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('publishing.form.unpublish_title')}
        description={t('publishing.form.unpublish_body')}
        confirmLabel={t('publishing.form.unpublish')}
        processing={busy}
        onConfirm={() => post('tarik')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('publishing.form.delete_title')}
        description={t('publishing.form.delete_body')}
        confirmLabel={t('publishing.form.delete')}
        destructive
        processing={busy}
        onConfirm={() => post('hapus')}
      />
    </div>
  )
}
