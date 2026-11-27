import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import pg from 'pg'

/**
 * int8 (bigint ids) as numbers, and date columns as plain "YYYY-MM-DD"
 * strings so no timezone shifts a calendar date.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10))
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    /**
     * PostgreSQL 18 in production and CI (D-398). Timestamps are stored
     * as timestamptz and shown in Asia/Jakarta (D-165).
     */
    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD')?.release(),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
        /**
         * Migrations are forward-only (D-085): no rollbacks in production.
         */
        disableRollbacksInProduction: true,
      },
      seeders: {
        paths: ['database/seeders'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
      },
      debug: app.inDev && env.get('LOG_LEVEL') === 'debug',
    },
  },
})

export default dbConfig
