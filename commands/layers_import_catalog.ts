import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Imports the extracurricular catalog as the national base package of
 * the layer model (R1-07). The package stays `draft` until Tim
 * Validasi signs the catalog off (D-113); `--activate` publishes it.
 */
export default class LayersImportCatalog extends BaseCommand {
  static commandName = 'layers:import-catalog'
  static description =
    'Import docs/data/catalogs/extracurriculars.json as the national layer package'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Publish the package (after Tim Validasi sign-off)' })
  declare activate: boolean

  @flags.string({ description: 'Catalog file (default docs/data/catalogs/extracurriculars.json)' })
  declare file: string | undefined

  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { importExtracurricularCatalog } = await import('#layers/domains/extracurricular_import')
    const report = await db.transaction((trx) =>
      importExtracurricularCatalog(trx, { file: this.file, activate: this.activate })
    )
    this.logger.success(
      `extracurricular: ${report.created} created, ${report.revised} revised, ${report.unchanged} unchanged; package ${report.status}`
    )
  }
}
