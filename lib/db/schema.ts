import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  phoneNumber: text('phoneNumber').unique(),
  phoneNumberVerified: boolean('phoneNumberVerified').notNull().default(false),
  username: text('username').unique(),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

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

export const carListings = pgTable('car_listings', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  condition: text('condition').notNull(),
  mileage: integer('mileage').notNull().default(0),
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
  city: text('city'),
  description: text('description'),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  verificationImage: text('verification_image'),
  verified: boolean('verified').notNull().default(false),
  status: text('status').notNull().default('pending'),
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

export type CarListing = typeof carListings.$inferSelect
export type PublicCarListing = Pick<CarListing, 'id' | 'make' | 'model' | 'year' | 'condition' | 'mileage' | 'askingPrice' | 'city' | 'images' | 'verified'>
export type OwnerCarListing = Pick<CarListing, 'id' | 'make' | 'model' | 'year' | 'condition' | 'askingPrice' | 'status' | 'images'>
