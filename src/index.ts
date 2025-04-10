import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
// import { createFiberplane } from "@fiberplane/hono";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as schema from "./db/schema";
import { HTTPException } from 'hono/http-exception';

// Types for environment variables and context
type Bindings = {
  DB: D1Database; // Cloudflare D1 database binding
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

// Create the app with type-safe bindings and variables
// For more information on OpenAPIHono, see: https://hono.dev/examples/zod-openapi
const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware: Set up D1 database connection for all routes
app.use(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("db", db);
  await next();
});

// --- Notes Schemas START ---
const NoteSchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  title: z.string().min(1).max(255).openapi({ example: "Meeting Notes" }),
  content: z.string().min(1).openapi({ example: "Discuss project milestones." }),
  createdAt: z.string().datetime().openapi({ example: "2025-04-11T10:00:00Z" }),
  updatedAt: z.string().datetime().openapi({ example: "2025-04-11T10:05:00Z" }),
}).openapi("Note");

const NewNoteSchema = NoteSchema.pick({ title: true, content: true }).openapi("NewNote");
const UpdateNoteSchema = NewNoteSchema.partial().openapi("UpdateNote"); // Allow partial updates

const ErrorSchema = z.object({
  message: z.string().openapi({ example: "Note not found" }),
}).openapi("Error");

const ParamsSchema = z.object({
  id: z.coerce.number().int().positive().openapi({
    param: { name: 'id', in: 'path' },
    example: 123,
  }),
});
// --- Notes Schemas END ---

// Route Definitions
// Each route is defined separately with its request/response schema
// This enables automatic OpenAPI documentation and type safety

const getNotes = createRoute({
  method: "get",
  path: "/api/notes",
  responses: {
    200: { content: { "application/json": { schema: z.array(NoteSchema) } }, description: "List of notes" },
  },
});

const getNoteById = createRoute({
  method: "get",
  path: "/api/notes/{id}",
  request: { params: ParamsSchema },
  responses: {
    200: { content: { "application/json": { schema: NoteSchema } }, description: "Single note" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Note not found" },
  },
});

const createNote = createRoute({
  method: "post",
  path: "/api/notes",
  request: { body: { required: true, content: { "application/json": { schema: NewNoteSchema } } } },
  responses: {
    201: { content: { "application/json": { schema: NoteSchema } }, description: "Note created" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid input" },
  },
});

const updateNote = createRoute({
  method: "put",
  path: "/api/notes/{id}",
  request: {
    params: ParamsSchema,
    body: { required: true, content: { "application/json": { schema: UpdateNoteSchema } } }
  },
  responses: {
    200: { content: { "application/json": { schema: NoteSchema } }, description: "Note updated" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid input or no fields to update" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Note not found" },
  },
});

const deleteNote = createRoute({
  method: "delete",
  path: "/api/notes/{id}",
  request: { params: ParamsSchema },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Note deleted" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Note not found" },
  },
});

// Route Implementations
// Connect the route definitions to their handlers using .openapi()
app
  .openapi(getNotes, async (c) => {
    const db = c.get("db");
    const allNotes = await db.query.notes.findMany({
      orderBy: [desc(schema.notes.createdAt)],
    });
    return c.json(allNotes);
  })
  .openapi(getNoteById, async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const note = await db.query.notes.findFirst({
      where: eq(schema.notes.id, id),
    });
    if (!note) {
      throw new HTTPException(404, { message: 'Note not found' })
    }
    return c.json(note);
  })
  .openapi(createNote, async (c) => {
    const db = c.get("db");
    const { title, content } = c.req.valid("json");

    const newId = Math.floor(Math.random() * 1000000);

    const result = await db
      .insert(schema.notes)
      .values({ id: newId, title, content })
      .returning()
      .get();

    if (!result) {
      throw new HTTPException(500, { message: 'Failed to create note' })
    }

    const createdNote = await db.query.notes.findFirst({ where: eq(schema.notes.id, result.id) });
    if (!createdNote) {
      throw new HTTPException(500, { message: 'Failed to retrieve created note' })
    }

    return c.json(createdNote, 201);
  })
  .openapi(updateNote, async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const noteData = c.req.valid("json");

    if (Object.keys(noteData).length === 0) {
      throw new HTTPException(400, { message: 'No fields provided for update' })
    }

    const updateValues = {
      ...noteData,
      updatedAt: new Date().toISOString(),
    };

    const updateResult = await db
      .update(schema.notes)
      .set(updateValues)
      .where(eq(schema.notes.id, id))
      .run();

    if (updateResult.changes === 0) {
      throw new HTTPException(404, { message: 'Note not found or no changes made' });
    }

    const updatedNote = await db.query.notes.findFirst({ where: eq(schema.notes.id, id) });
    if (!updatedNote) {
      throw new HTTPException(404, { message: 'Note not found after update attempt' });
    }
    return c.json(updatedNote);
  })
  .openapi(deleteNote, async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    // console.log(`>>> DELETE /api/notes/${id}`); // Log entry - REMOVED

    // Rely on global onError for exception handling
    const result = await db
      .delete(schema.notes)
      .where(eq(schema.notes.id, id))
      .run();
    // console.log(`>>> DELETE result for ID ${id}:`, JSON.stringify(result)); // Log result - REMOVED

    if (result.changes === 0) {
      // console.log(`>>> ID ${id} not found, throwing 404`); // Log branch taken - REMOVED
      throw new HTTPException(404, { message: 'Note not found' })
    }

    // console.log(`>>> ID ${id} found and deleted, returning 200`); // Log branch taken - REMOVED
    return c.json({ ok: true });

    /* // try-catch and reversed logic removed
    try {
      // ... code ...
    } catch (err) {
      // ... code ...
    }
    */
  })
  // Generate OpenAPI spec at /openapi.json
  .doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Notes API (HONC)",
      version: "1.0.0",
      description: "API for managing notes, built with Hono, OpenAPI, Node.js, Cloudflare D1.",
    },
  })
/*
.use("/fp/*", createFiberplane({ // Fiberplane UI for exploring API
  app,
  openapi: { url: "/openapi.json" },
}));
*/

// Error Handler (Optional but recommended)
app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.url}`, err);
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: 'Internal Server Error' }, 500);
});

export default app;
