import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

/**
 * Finds an account by e-mail on the unique index `lower(email)` of
 * `users` and `staff_users`. The auth mixin's own lookup
 * (`where email = ?`) cannot use that index, so every sign-in read the
 * whole table (R1-11). Addresses are stored in lower case; this also
 * matches an address typed with capitals.
 */
export function byEmail<Model extends LucidModel>(
  model: Model,
  email: string
): ModelQueryBuilderContract<Model> {
  return model.query().whereRaw('lower(email) = lower(?)', [email.trim()])
}
