import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), requestId: text("request_id").notNull().unique(), fingerprint: text("fingerprint").notNull(),
  buildJson: text("build_json").notNull(), quoteJson: text("quote_json").notNull(), subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(), totalCents: integer("total_cents"), currency: text("currency").notNull(),
  sessionId: text("session_id").unique(), checkoutUrl: text("checkout_url"), status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(), paidAt: text("paid_at"),
});

// Customer collections use unguessable access links; only their hashes are stored.
export const atelierCollections = sqliteTable("atelier_collections", {
 id: text("id").primaryKey(), tokenHash: text("token_hash").notNull().unique(), name: text("name").notNull(),
 buildsJson: text("builds_json").notNull(), revision: integer("revision").notNull().default(1), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const atelierRequests = sqliteTable("atelier_requests", {
 id: text("id").primaryKey(), tokenHash: text("token_hash").notNull().unique(), kind: text("kind").notNull(), name: text("name").notNull(), email: text("email").notNull(),
 buildJson: text("build_json").notNull(), message: text("message").notNull(), detailsJson: text("details_json").notNull(), status: text("status").notNull().default("received"),
 orderId: text("order_id"), serial: text("serial"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t=>[index("atelier_requests_created").on(t.createdAt)]);
export const atelierJournal = sqliteTable("atelier_journal", {
 id: text("id").primaryKey(), requestId: text("request_id").notNull(), title: text("title").notNull(), stage: text("stage").notNull(), note: text("note").notNull(),
 image: text("image").notNull(), videoId: text("video_id").notNull(), createdAt: text("created_at").notNull(),
},t=>[index("atelier_journal_request").on(t.requestId)]);
export const atelierStories = sqliteTable("atelier_stories", {
 id: text("id").primaryKey(), requestId: text("request_id").notNull().unique(), title: text("title").notNull(), author: text("author").notNull(), story: text("story").notNull(),
 buildJson: text("build_json").notNull(), image: text("image").notNull(), videoId: text("video_id").notNull(), kind: text("kind").notNull(), createdAt: text("created_at").notNull(),
});
export const atelierEvents = sqliteTable("atelier_events", { id:text("id").primaryKey(), title:text("title").notNull(), startsAt:text("starts_at").notNull(), description:text("description").notNull(), url:text("url").notNull() });
export const atelierSettings = sqliteTable("atelier_settings", {key:text("key").primaryKey(),value:text("value").notNull()});
export const atelierPolls = sqliteTable("atelier_polls", {id:text("id").primaryKey(),title:text("title").notNull(),optionsJson:text("options_json").notNull(),createdAt:text("created_at").notNull()});
export const atelierVotes = sqliteTable("atelier_votes", {id:text("id").primaryKey(),pollId:text("poll_id").notNull(),voterHash:text("voter_hash").notNull(),optionId:text("option_id").notNull(),createdAt:text("created_at").notNull()},t=>[index("atelier_votes_poll").on(t.pollId)]);
export const atelierLimits = sqliteTable("atelier_limits", {id:text("id").primaryKey(),count:integer("count").notNull(),createdAt:text("created_at").notNull()});
export const atelierMetrics = sqliteTable("atelier_metrics", {id:text("id").primaryKey(),event:text("event").notNull(),count:integer("count").notNull(),day:text("day").notNull()});
