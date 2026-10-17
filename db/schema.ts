import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), requestId: text("request_id").notNull().unique(), fingerprint: text("fingerprint").notNull(),
  buildJson: text("build_json").notNull(), quoteJson: text("quote_json").notNull(), subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(), totalCents: integer("total_cents"), currency: text("currency").notNull(),
  sessionId: text("session_id").unique(), checkoutUrl: text("checkout_url"), status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(), paidAt: text("paid_at"),
});
