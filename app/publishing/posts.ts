import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type Event from '#models/event'
import type Story from '#models/story'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'
import { uniqueSlug } from './slugs.js'

/**
 * Saving, publishing, taking back and removing Acara and Cerita
 * Sekolah (R2-05). The controllers check `events.manage` and
 * `stories.manage`; this keeps the slug, the status and the log
 * (`event.*`, `story.*`) the same for both.
 */
type Post = Event | Story
type PostType = 'event' | 'story'

const tables = { event: 'events', story: 'stories' } as const

export class PostStateException extends Error {
  constructor() {
    super('The post is not in the state this change needs')
  }
}

/** Creates (a new model instance) or updates a post, publishing it when asked. */
export async function savePost<T extends Post>(
  staff: StaffUser,
  type: PostType,
  post: T,
  columns: Partial<T>,
  publish: boolean
) {
  await db.transaction(async (trx) => {
    const isNew = !post.$isPersisted
    const wasDraft = isNew || post.status === 'draft'
    post.useTransaction(trx)
    post.merge({ ...columns, updatedByStaffId: staff.id } as Partial<T>)
    if (isNew) {
      post.createdByStaffId = staff.id
      post.status = 'draft'
      post.publishedAt = null
    }
    // The address stays the same once a post has been published.
    if (wasDraft && (isNew || post.$dirty.title)) {
      post.slug = await uniqueSlug(trx, tables[type], post.title, isNew ? undefined : post.id)
    }
    const publishing = wasDraft && publish
    if (publishing) {
      post.status = 'published'
      post.publishedAt = DateTime.now()
    }
    const fields = Object.keys(post.$dirty)
    await post.save()
    await logStaffActivity(
      staff,
      `${type}.${publishing ? 'published' : isNew ? 'created' : 'updated'}`,
      type,
      post.id,
      isNew ? { title: post.title } : { title: post.title, fields },
      trx
    )
  })
  return post
}

export async function unpublishPost(staff: StaffUser, type: PostType, post: Post) {
  if (post.status !== 'published') throw new PostStateException()
  await db.transaction(async (trx) => {
    post.useTransaction(trx)
    post.merge({ status: 'draft', publishedAt: null, updatedByStaffId: staff.id })
    await post.save()
    await logStaffActivity(staff, `${type}.unpublished`, type, post.id, { title: post.title }, trx)
  })
}

export async function deletePost(staff: StaffUser, type: PostType, post: Post) {
  if (post.status !== 'draft') throw new PostStateException()
  await db.transaction(async (trx) => {
    post.useTransaction(trx)
    await post.delete()
    await logStaffActivity(staff, `${type}.deleted`, type, post.id, { title: post.title }, trx)
  })
}
