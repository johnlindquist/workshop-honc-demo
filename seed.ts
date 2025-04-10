import { execSync } from 'child_process';

// Data to seed
const seedNotes = [
  {
    id: 1,
    title: 'First Note',
    content: 'This is the content of the first note seeded into the database.'
  },
  {
    id: 2,
    title: 'Second Note',
    content: 'Content for the second note. Supports basic text.'
  },
  {
    id: 3,
    title: 'Third Note',
    content: 'The third note has some more content here.'
  }
];

// Database name from wrangler.toml
const DB_NAME = 'honc-d1-database';

async function runSeed() {
  console.log('Seeding database using wrangler d1 execute...');
  const start = Date.now();

  try {
    // Clear existing notes first (optional, but good for repeatable seeding)
    console.log('Deleting existing notes...');
    const deleteSql = `DELETE FROM notes;`;
    // Use --json flag to suppress interactive prompts and get machine-readable output/errors
    execSync(`wrangler d1 execute ${DB_NAME} --local --command="${deleteSql}" --json`, { stdio: 'inherit' });
    console.log('Existing notes deleted.');

    console.log('Inserting new notes...');
    // Construct a single INSERT statement with multiple VALUES clauses
    // Need to escape quotes within the SQL string for the command line
    const valuesSql = seedNotes.map(note =>
      `(${note.id}, '${escapeString(note.title)}', '${escapeString(note.content)}')`
    ).join(', ');

    // We might need to handle timestamps manually if defaults aren't applied via wrangler execute
    // For simplicity, we'll omit them here and rely on DB defaults if they work.
    const insertSql = `INSERT INTO notes (id, title, content) VALUES ${valuesSql};`;

    // Execute the INSERT statement
    execSync(`wrangler d1 execute ${DB_NAME} --local --command="${insertSql}" --json`, { stdio: 'inherit' });

    console.log(`Inserted ${seedNotes.length} notes.`);

  } catch (error) {
    console.error('Error seeding database via wrangler:', error);
    process.exit(1); // Exit with error code
  }

  const end = Date.now();
  console.log(`Database seeding finished in ${end - start}ms.`);
}

// Helper to escape single quotes for SQL strings passed via command line
function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

runSeed().catch((error) => {
  console.error('Unhandled error during seeding:', error);
  process.exit(1);
});
