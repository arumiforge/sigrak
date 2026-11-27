import { v7 as uuidv7 } from 'uuid'
import { beforeCreate, type BaseModel } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'

/**
 * Rows exposed in URLs or props carry a UUIDv7 `public_id`, so counts
 * are not leaked and ids cannot be enumerated (data model: Keys).
 */
export function withPublicId<T extends NormalizeConstructor<typeof BaseModel>>(superclass: T) {
  class ModelWithPublicId extends superclass {
    declare publicId: string

    @beforeCreate()
    static assignPublicId(model: ModelWithPublicId) {
      if (!model.publicId) {
        model.publicId = uuidv7()
      }
    }
  }
  return ModelWithPublicId
}
