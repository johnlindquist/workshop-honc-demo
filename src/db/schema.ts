import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Define types for inserting and selecting notes
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export const notes = sqliteTable("notes", {
  id: integer("id", { mode: "number" }).primaryKey(), // Consider if auto-increment is needed/supported or use UUIDs
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`), // Consider ON UPDATE trigger if needed/supported
});
