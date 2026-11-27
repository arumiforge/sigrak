import vine from '@vinejs/vine'

/**
 * Sign-in with email and password (app. and admin.).
 */
export const emailLoginValidator = vine.create({
  email: vine.string().trim().toLowerCase().email().maxLength(254),
  password: vine.string().minLength(1).maxLength(200),
})

/**
 * Sign-in with an exam card (ujian.).
 */
export const examCardLoginValidator = vine.create({
  username: vine.string().trim().minLength(1).maxLength(32),
  password: vine.string().minLength(1).maxLength(64),
})
