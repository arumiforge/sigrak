import vine from '@vinejs/vine'
import { SCOPE_FIELDS, SCOPE_LEVELS, STAFF_ROLES } from './roles.js'

const ids = () => vine.array(vine.number().withoutDecimals().positive()).maxLength(500).optional()

/** A scope as the Staf page sends it (D-338); app/staff/staff_accounts.ts cleans it per role. */
const scopeFields = {
  region_ids: ids(),
  school_ids: ids(),
  levels: vine.array(vine.enum(SCOPE_LEVELS)).maxLength(SCOPE_LEVELS.length).optional(),
  fields: vine.array(vine.enum(SCOPE_FIELDS)).maxLength(SCOPE_FIELDS.length).optional(),
}

export const createStaffValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(150),
  email: vine.string().trim().toLowerCase().email().maxLength(254),
  role: vine.enum(STAFF_ROLES),
  ...scopeFields,
})

export const grantRoleValidator = vine.create({
  role: vine.enum(STAFF_ROLES),
  ...scopeFields,
})

export const scopeValidator = vine.create(scopeFields)

/**
 * Staff passwords: at least 12 characters with letters and numbers,
 * longer than school accounts (D-183) because a console account reaches
 * every school.
 */
export const staffPasswordValidator = vine.create({
  password: vine
    .string()
    .minLength(12)
    .maxLength(200)
    .regex(/\p{L}/u)
    .regex(/\p{N}/u)
    .confirmed({ confirmationField: 'password_confirmation' }),
})

export const scopeSearchValidator = vine.create({
  wilayah: vine.string().trim().minLength(2).maxLength(100).optional(),
  sekolah: vine.string().trim().minLength(2).maxLength(100).optional(),
})

export const activityFilterValidator = vine.create({
  staf: vine.number().withoutDecimals().positive().optional(),
  aksi: vine.string().trim().maxLength(40).optional(),
  dari: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sampai: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  halaman: vine.number().withoutDecimals().min(1).max(10000).optional(),
})
