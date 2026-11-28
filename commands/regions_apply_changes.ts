import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Applies the accepted region changes whose day has come (D-466). Meant
 * to run once a day shortly after midnight WIB from the scheduler role;
 * running it more often is harmless.
 */
export default class RegionsApplyChanges extends BaseCommand {
  static commandName = 'regions:apply-changes'
  static description = 'Apply accepted region changes that take effect today or earlier'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { RegionChangeQueue } = await import('#regions/region_change_queue')
    const applied = await RegionChangeQueue.applyDue()
    this.logger.success(`${applied} region changes applied`)
  }
}
