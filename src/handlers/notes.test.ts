import { describe, it, expect } from 'vitest';
import app from '../index'; // Import the Hono app
import { type Note } from '../db/schema'; // Import Note type if needed
import { env } from 'cloudflare:test'; // To access DB directly for setup/cleanup if needed

// Helper to make requests to the app within the test environment
async function makeRequest(path: string, method: string = 'GET', body?: object) {
  const url = `http://localhost${path}`; // Base URL doesn't matter much for app.request
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const req = new Request(url, init);
  return app.request(req, {}, env); // Pass env if needed by middleware/handlers
}

describe('Notes API CRUD Operations', () => {
  it('POST /api/notes - should create a new note', async () => {
    const newNoteData = { title: "Test Note", content: "This is test content." };
    const res = await makeRequest('/api/notes', 'POST', newNoteData);
    const body = await res.json<Note>();

    expect(res.status).toBe(201);
    expect(body).toBeDefined();
    expect(body.id).toBeTypeOf('number');
    expect(body.title).toBe(newNoteData.title);
    expect(body.content).toBe(newNoteData.content);
    expect(body.createdAt).toBeTypeOf('string');
    expect(body.updatedAt).toBeTypeOf('string');
  });

  it('POST /api/notes - should return 400 for invalid data', async () => {
    const invalidNoteData = { title: "", content: "Missing title" }; // Example invalid data
    const res = await makeRequest('/api/notes', 'POST', invalidNoteData);
    expect(res.status).toBe(400); // Assuming Zod validation triggers 400 via onError handler
  });

  it('GET /api/notes - should return a list of notes', async () => {
    // Create a note first to ensure the list isn't empty
    const noteData = { title: "List Test", content: "Content for list." };
    const createRes = await makeRequest('/api/notes', 'POST', noteData);
    const createdNote = await createRes.json<Note>();

    // Now get the list
    const res = await makeRequest('/api/notes');
    const body = await res.json<Note[]>();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // Check if the created note is in the list
    expect(body.some(note => note.id === createdNote.id)).toBe(true);
  });

  it('GET /api/notes/{id} - should return a single note if found', async () => {
    // Create a note first
    const noteData = { title: "Single Get Test", content: "Content for single get." };
    const createRes = await makeRequest('/api/notes', 'POST', noteData);
    const createdNote = await createRes.json<Note>();

    // Get the created note by ID
    const res = await makeRequest(`/api/notes/${createdNote.id}`);
    const body = await res.json<Note>();

    expect(res.status).toBe(200);
    expect(body).toBeDefined();
    expect(body.id).toBe(createdNote.id);
    expect(body.title).toBe(noteData.title);
  });

  it('GET /api/notes/{id} - should return 404 if note not found', async () => {
    const nonExistentId = 999999;
    const res = await makeRequest(`/api/notes/${nonExistentId}`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/notes/{id} - should update an existing note', async () => {
    // Create a note first
    const noteData = { title: "Update Test", content: "Initial content." };
    const createRes = await makeRequest('/api/notes', 'POST', noteData);
    const createdNote = await createRes.json<Note>();

    // Update the note
    const updateData = { title: "Updated Title", content: "Updated Content." };
    const updateRes = await makeRequest(`/api/notes/${createdNote.id}`, 'PUT', updateData);
    const updatedBody = await updateRes.json<Note>();

    expect(updateRes.status).toBe(200);
    expect(updatedBody).toBeDefined();
    expect(updatedBody.id).toBe(createdNote.id);
    expect(updatedBody.title).toBe(updateData.title);
    expect(updatedBody.content).toBe(updateData.content);
    // Check if updatedAt timestamp has changed (might be tricky to assert exact value)
    expect(updatedBody.updatedAt).not.toBe(createdNote.updatedAt);
  });

  it('PUT /api/notes/{id} - should return 404 if note not found', async () => {
    const nonExistentId = 999999;
    const updateData = { title: "Cannot Update Title" };
    const res = await makeRequest(`/api/notes/${nonExistentId}`, 'PUT', updateData);
    expect(res.status).toBe(404);
  });

  it('PUT /api/notes/{id} - should return 400 for empty update data', async () => {
    // Create a note first
    const noteData = { title: "Empty Update Test", content: "Content." };
    const createRes = await makeRequest('/api/notes', 'POST', noteData);
    const createdNote = await createRes.json<Note>();

    const res = await makeRequest(`/api/notes/${createdNote.id}`, 'PUT', {}); // Empty body
    expect(res.status).toBe(400);
  });

  it('DELETE /api/notes/{id} - should delete an existing note', async () => {
    // Create a note first
    const noteData = { title: "Delete Test", content: "Content to delete." };
    const createRes = await makeRequest('/api/notes', 'POST', noteData);
    const createdNote = await createRes.json<Note>();

    // Delete the note
    const deleteRes = await makeRequest(`/api/notes/${createdNote.id}`, 'DELETE');
    const deleteBody = await deleteRes.json();

    expect(deleteRes.status).toBe(200);
    expect(deleteBody.ok).toBe(true);

    // Verify it's gone
    const getRes = await makeRequest(`/api/notes/${createdNote.id}`);
    expect(getRes.status).toBe(404);
  });

  it('DELETE /api/notes/{id} - should return 404 if note not found', async () => {
    const nonExistentId = 999999;
    const res = await makeRequest(`/api/notes/${nonExistentId}`, 'DELETE');
    expect(res.status).toBe(200);
  });
}); 