import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import type { ListingCategory, ListingDetails } from '@/lib/listing-categories'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  phoneNumber: text('phoneNumber').unique(),
  phoneNumberVerified: boolean('phoneNumberVerified').notNull().default(false),
  username: text('username').unique(),
  governorate: text('governorate'),
  messagingPublicKey: text('messaging_public_key'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [uniqueIndex('user_email_lower_unique').on(sql`lower(${table.email})`)])

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'archived'
export type SupportCategory = 'technical_issue' | 'listing_question' | 'report_violation' | 'general_inquiry'

export const supportTickets = pgTable('support_tickets', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  reference: varchar('reference', { length: 32 }).notNull().unique(),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  whatsappNumber: varchar('whatsapp_number', { length: 32 }),
  category: varchar('category', { length: 40 }).$type<SupportCategory>().notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  captchaNonce: varchar('captcha_nonce', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('support_tickets_captcha_nonce_unique').on(table.captchaNonce),
  index('support_tickets_ip_created_at_idx').on(table.ipHash, table.createdAt),
])

export type SupportTicket = typeof supportTickets.$inferSelect
export type AdminSupportTicket = Pick<SupportTicket, 'id' | 'reference' | 'fullName' | 'whatsappNumber' | 'category' | 'message' | 'createdAt'>

export const carListings = pgTable('car_listings', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  category: text('category').$type<ListingCategory>().default('cars'),
  details: jsonb('details').$type<ListingDetails>(),
  year: integer('year').notNull(),
  condition: text('condition').notNull(),
  mileage: integer('mileage').notNull().default(0),
  mileageUnknown: boolean('mileageUnknown').notNull().default(false),
  usageMonths: integer('usageMonths'),
  maintenanceVisited: boolean('maintenanceVisited').notNull().default(false),
  maintenanceReason: text('maintenanceReason'),
  repaired: boolean('repaired').notNull().default(false),
  repairDetails: text('repairDetails'),
  partsChanged: boolean('partsChanged').notNull().default(false),
  changedParts: text('changedParts'),
  askingPrice: integer('askingPrice').notNull(),
  negotiationMin: integer('negotiationMin'),
  negotiationMax: integer('negotiationMax'),
  negotiable: boolean('negotiable').notNull().default(false),
  paintCondition: text('paintCondition'),
  paintDetails: text('paintDetails'),
  transmission: text('transmission'),
  fuelType: text('fuelType'),
  registrationStatus: text('registrationStatus'),
  whatsappOnly: boolean('whatsappOnly').notNull().default(false),
  city: text('city'),
  description: text('description'),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  verificationImage: text('verification_image'),
  verified: boolean('verified').notNull().default(false),
  status: text('status').$type<ListingStatus>().notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  directRenewals: integer('direct_renewals').notNull().default(0),
  archivedByAdmin: boolean('archived_by_admin').notNull().default(false),
  archivedByExpiry: boolean('archived_by_expiry').notNull().default(false),
  hiddenByOwner: boolean('hidden_by_owner').notNull().default(false),
  sellerName: text('sellerName'),
  sellerPhone: text('sellerPhone'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const userFollows = pgTable('user_follows', {
  followerId: text('follower_id').notNull(),
  followedId: text('followed_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.followerId, table.followedId] }),
  index('user_follows_followed_idx').on(table.followedId, table.createdAt),
])

export const listingLikes = pgTable('listing_likes', {
  userId: text('user_id').notNull(),
  listingId: text('listing_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.listingId] }),
  index('listing_likes_listing_idx').on(table.listingId),
])

export const listingComments = pgTable('listing_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: text('listing_id').notNull(),
  authorId: text('author_id').notNull(),
  body: varchar('body', { length: 1200 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('listing_comments_listing_created_idx').on(table.listingId, table.createdAt)])

export const socialNotifications = pgTable('social_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: text('recipient_id').notNull(),
  actorId: text('actor_id').notNull(),
  notificationType: text('notification_type').notNull(),
  entityId: text('entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (table) => [index('social_notifications_recipient_created_idx').on(table.recipientId, table.createdAt)])

export const socialConversations = pgTable('social_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  participantOne: text('participant_one').notNull(),
  participantTwo: text('participant_two').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('social_conversations_participants_unique').on(table.participantOne, table.participantTwo),
  index('social_conversations_participant_two_idx').on(table.participantTwo, table.updatedAt),
])

export const socialMessages = pgTable('social_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(),
  senderId: text('sender_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  senderWrappedKey: text('sender_wrapped_key').notNull(),
  recipientWrappedKey: text('recipient_wrapped_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('social_messages_conversation_created_idx').on(table.conversationId, table.createdAt)])

export type SocialMessage = typeof socialMessages.$inferSelect
export type SocialNotification = typeof socialNotifications.$inferSelect

export type CarListing = typeof carListings.$inferSelect
export type PublicCarListing = Pick<CarListing, 'id' | 'make' | 'model' | 'category' | 'details' | 'year' | 'condition' | 'mileage' | 'mileageUnknown' | 'askingPrice' | 'negotiable' | 'city' | 'images' | 'verified'>
export type OwnerCarListing = Pick<CarListing, 'id' | 'make' | 'model' | 'category' | 'details' | 'year' | 'condition' | 'city' | 'askingPrice' | 'status' | 'images' | 'rejectionReason' | 'expiresAt' | 'directRenewals' | 'archivedByAdmin' | 'archivedByExpiry' | 'hiddenByOwner' | 'publishedAt' | 'createdAt'>
