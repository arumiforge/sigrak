import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Rules for the generated database/schema.ts. bigint ids are parsed as
 * numbers (see config/database.ts); they stay far below 2^53.
 */
export default {
  types: {
    bigint: { tsType: 'number', decorators: [{ name: '@column' }] },
  },
  primaryKey: (_table, primaryKeys) =>
    primaryKeys[0]
      ? {
          columnName: primaryKeys[0],
          columnInfo: {
            tsType: 'number',
            decorators: [{ name: '@column', args: { isPrimary: true } }],
          },
        }
      : undefined,
  columns: {
    password: { tsType: 'string', decorators: [{ name: '@column', args: { serializeAs: null } }] },
    joint_leave_school_days: { tsType: 'string[]', decorators: [{ name: '@column' }] },
    meta: { tsType: 'Record<string, unknown>', decorators: [{ name: '@column' }] },
    specification: { tsType: 'Record<string, unknown>', decorators: [{ name: '@column' }] },
    error_meta: { tsType: 'Record<string, unknown>', decorators: [{ name: '@column' }] },
    output: { tsType: 'Record<string, unknown>', decorators: [{ name: '@column' }] },
    secret: { tsType: 'string', decorators: [{ name: '@column', args: { serializeAs: null } }] },
    token_hash: {
      tsType: 'string',
      decorators: [{ name: '@column', args: { serializeAs: null } }],
    },
    value: { tsType: 'unknown', decorators: [{ name: '@column' }] },
    changes: { tsType: 'Record<string, unknown>', decorators: [{ name: '@column' }] },
    // Staff scopes (D-338): bigint[] arrives as strings; StaffRoleAssignment converts them.
    region_ids: { tsType: 'number[]', decorators: [{ name: '@column' }] },
    school_ids: { tsType: 'number[]', decorators: [{ name: '@column' }] },
    levels: { tsType: 'string[]', decorators: [{ name: '@column' }] },
    fields: { tsType: 'string[]', decorators: [{ name: '@column' }] },
    // Curriculum console (R2-08): staff who imported into a version; CurriculumVersion converts them.
    imported_by_ids: { tsType: 'number[]', decorators: [{ name: '@column' }] },
    // Kabar targets (D-319, R2-05): bigint[] arrives as strings; Announcement converts them.
    target_region_ids: { tsType: 'number[]', decorators: [{ name: '@column' }] },
    target_school_ids: { tsType: 'number[]', decorators: [{ name: '@column' }] },
    target_levels: { tsType: 'string[]', decorators: [{ name: '@column' }] },
    target_roles: { tsType: 'string[]', decorators: [{ name: '@column' }] },
  },
} satisfies SchemaRules
