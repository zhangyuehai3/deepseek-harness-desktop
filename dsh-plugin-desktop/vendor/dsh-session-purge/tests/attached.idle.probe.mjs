/**
 * Probe: what ACTUALLY happens if we delete the log of an attached-but-idle
 * session, without detaching it first?
 *
 * This decides the design. If the write-behind controller simply re-creates the
 * log on its next flush, deleting an attached session's files is useless and the
 * purge must refuse (or find a real detach). If the deletion sticks, the gate can
 * safely be loosened to "refuse only a RUNNING agent".
 */
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { JsonlSessionPersistence } from '@deepseek-ai/dsh-session-persistence-jsonl';

const root = await mkdtemp(join(tmpdir(), 'purge-attached-'));
const cwd = join(root, 'proj');
await mkdir(cwd, { recursive: true });
const id = 'session-attached-0000-0000-0000-000000000000';

const ctx = new Context();
// A stand-in session store that REPORTS an attached session, mimicking the
// desktop app's re-attached last session.
const attached = { id, header: { id, cwd }, events: [] };
ctx.provide('sessions', {
  get: (probe) => (probe === id ? attached : undefined),
  list: () => [attached],
});

// Seed the durable log BEFORE mounting the backend: once the store reports an
// attached session, the coordinator adopts that id and refuses create().
{
  const seedCtx = new Context();
  seedCtx.provide('sessions', { get: () => undefined, list: () => [] });
  const seed = new JsonlSessionPersistence(seedCtx, { root, packChunks: false, compression: 'none' });
  await seed.create({ version: 1, id, createdAt: Date.now(), cwd });
  await seed.append(id, [{ type: 'turn/start', seq: 0, time: Date.now(), data: { turnId: 't1' } }]);
  await seedCtx.fiber.dispose();
}
const persistence = new JsonlSessionPersistence(ctx, { root, packChunks: false, compression: 'none' });

const location = persistence.locate({ id, cwd });
console.log('log path:', location.path);
const dir = location.path.slice(0, location.path.lastIndexOf('/'));
console.log('dir exists before:', await stat(dir).then(() => true, () => false));

// Delete the session directory exactly as the purge does.
await rm(dir, { recursive: true, force: true });
console.log('dir exists right after rm:', await stat(dir).then(() => true, () => false));

// Does any pending write-behind re-create it? Give it time and poke the backend.
await new Promise((r) => setTimeout(r, 300));
console.log('dir exists after 300ms idle:', await stat(dir).then(() => true, () => false));

// A flush is what a live session's controller does on its own schedule.
try { await persistence.append(id, [{ type: 'turn/end', seq: 1, time: Date.now(), data: { turnId: 't1' } }]); }
catch (error) { console.log('append after rm threw:', String(error).slice(0, 120)); }
console.log('dir exists after an append:', await stat(dir).then(() => true, () => false));

const listed = await persistence.list();
console.log('sessions listed now:', listed.length);

await ctx.fiber.dispose();
await rm(root, { recursive: true, force: true });
