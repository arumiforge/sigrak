import type StaffUser from '#models/staff_user'
import {
  diffFields,
  hintOf,
  readIntegration,
  writeIntegration,
  type StorageSettings,
} from './store.js'

/**
 * S3-compatible storage for non-personal files and backups (R2,
 * D-400). The values are saved for later; nothing switches storage
 * yet (R2-03), and pupils' files stay on the VPS disk either way.
 */

const STORAGE_SECRET_FIELDS = ['accessKeyId', 'secretAccessKey'] as const

export async function presentStorage() {
  const saved = await readIntegration('storage')
  const value = saved?.value ?? null
  return {
    saved: value !== null,
    values: {
      endpoint: value?.endpoint ?? '',
      region: value?.region ?? 'auto',
      bucket: value?.bucket ?? '',
    },
    accessKeyId: hintOf(value?.accessKeyId),
    secretAccessKey: hintOf(value?.secretAccessKey),
  }
}

export type StorageInput = Omit<StorageSettings, 'accessKeyId' | 'secretAccessKey'> & {
  accessKeyId?: string | null
  secretAccessKey?: string | null
}

/** Saves the storage values; an empty key field keeps the saved key. */
export async function saveStorage(staff: StaffUser, input: StorageInput) {
  return writeIntegration(staff, 'storage', (before) => {
    const value: StorageSettings = {
      endpoint: input.endpoint,
      region: input.region,
      bucket: input.bucket,
      accessKeyId: input.accessKeyId || before?.accessKeyId || '',
      secretAccessKey: input.secretAccessKey || before?.secretAccessKey || '',
    }
    return { value, changes: diffFields(before, value, STORAGE_SECRET_FIELDS) }
  })
}
