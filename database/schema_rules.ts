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
  },
} satisfies SchemaRules
