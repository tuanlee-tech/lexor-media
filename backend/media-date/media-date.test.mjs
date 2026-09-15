import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.BACKEND_ROOT || '_reference');
const worker = (await import(pathToFileURL(join(root, 'worker/src/index.ts')))).default;
const schema = readFileSync(join(root, 'd1/schema.sql'), 'utf8');
const migration = readFileSync(new URL('./001_media_date.sql', import.meta.url), 'utf8');

function setup(t, timezone = 'America/Los_Angeles') {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-15T01:00:00Z') });
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(schema);
  db.exec("INSERT INTO categories (id,title,handle) VALUES ('c','C','c'); INSERT INTO sub_categories (id,category_id,title,handle) VALUES ('s','c','S','s');");
  const env = {
    ADMIN_SECRET: 'test-only', SHOP_TIMEZONE: timezone,
    DB: { prepare(sql) {
      return { bind(...params) {
        const stmt = db.prepare(sql);
        return {
          async all() { return { results: stmt.all(...params) }; },
          async first() { return stmt.get(...params) || null; },
          async run() { stmt.run(...params); return { success: true }; },
        };
      } };
    } },
  };
  const request = async (path, method = 'GET', body) => {
    const response = await worker.fetch(new Request(`https://test${path}`, {
      method, headers: { 'X-Admin-Secret': 'test-only', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: response.status, ...await response.json() };
  };
  const create = (extra = {}) => request('/api/admin/media', 'POST', {
    category_id: 'c', sub_category_id: 's', media_type: 'image',
    url: 'https://test/image.jpg', title: 'Image', ...extra,
  });
  return { db, env, request, create };
}

test('calendar validation, trusted timezone boundary, null clearing and omitted PATCH preservation', async (t) => {
  const { env, request, create } = setup(t);
  for (const value of ['', '2026-2-01', '2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-09-15', '2026-09-14T00:00:00Z', 20260914, false, {}, []]) {
    assert.equal((await create({ media_date: value, today: '9999-12-31', timezone: 'UTC' })).status, 400, JSON.stringify(value));
  }
  for (const media_date of ['2000-02-29', '2024-02-29', '2026-09-14', '0001-01-01', null]) {
    const result = await create({ media_date });
    assert.equal(result.status, 201);
    assert.equal(result.item.media_date, media_date);
  }
  assert.equal((await create()).item.media_date, null);
  const { item } = await create({ media_date: '2026-09-14' });
  const path = `/api/admin/media/${item.id}`;
  assert.equal((await request(path, 'PATCH', { title: 'Renamed' })).item.media_date, '2026-09-14');
  assert.equal((await request(path, 'PATCH', { media_date: '2026-02-30' })).status, 400);
  assert.equal((await request(path)).item.media_date, '2026-09-14');
  assert.equal((await request(path, 'PATCH', { media_date: null })).item.media_date, null);
  env.SHOP_TIMEZONE = 'Asia/Tokyo';
  assert.equal((await create({ media_date: '2026-09-15' })).status, 201);
  for (const timezone of [undefined, '', 'Invalid/Timezone']) {
    env.SHOP_TIMEZONE = timezone;
    assert.equal((await create({ media_date: '2026-09-14' })).status, 500);
    assert.equal((await create({ media_date: null })).status, 201);
  }
});

test('SQL ordering precedes pagination for public/admin media and automatic covers, not folders', async (t) => {
  const { db, request } = setup(t);
  db.exec("INSERT INTO folders (id,category_id,sub_category_id,title,handle,sort_order) VALUES ('f','c','s','Z','f',0), ('g','c','s','A','g',1);");
  const insert = db.prepare('INSERT INTO media_items (id,category_id,sub_category_id,folder_id,media_type,url,title,media_date,manual_order,sort_order,created_at) VALUES (?,\'c\',\'s\',\'f\',\'image\',?,\'Image\',?,?,?,?)');
  for (const row of [
    ['null', null, null, -100, '2026-01-01'], ['older', '2020-01-01', null, -100, '2026-01-01'],
    ['sort', '2024-01-01', null, 2, '2026-01-01'], ['created', '2024-01-01', null, 1, '2024-01-01'],
    ['b', '2024-01-01', null, 1, '2025-01-01'], ['a', '2024-01-01', null, 1, '2025-01-01'],
  ]) insert.run(row[0], `https://test/${row[0]}.jpg`, ...row.slice(1));
  const expected = ['a', 'b', 'created', 'sort', 'older', 'null'];
  const publicIds = [];
  const adminIds = [];
  for (let page = 1; page <= 3; page++) {
    const result = await request(`/api/gallery/media?folder=f&type=image&limit=2&page=${page}`);
    assert.equal(result.has_more, page < 3);
    assert.ok(result.media.every((item) => Object.hasOwn(item, 'media_date')));
    publicIds.push(...result.media.map((item) => item.id));
    adminIds.push(...(await request(`/api/admin/media?limit=2&offset=${(page - 1) * 2}`)).items.map((item) => item.id));
  }
  assert.deepEqual(publicIds, expected);
  assert.deepEqual(adminIds, expected);
  const { folders } = await request('/api/gallery/media?type=folder');
  assert.deepEqual(folders.map((folder) => folder.id), ['f', 'g']);
  assert.equal(folders[0].cover_image_url, 'https://test/a.jpg');
  db.exec("UPDATE folders SET cover_image_url = 'https://test/manual.jpg' WHERE id = 'f'");
  assert.equal((await request('/api/gallery/media?type=folder')).folders[0].cover_image_url, 'https://test/manual.jpg');
});

test('manual drag order overrides dates, clears on reset, new files insert by date', async (t) => {
  const { db, request, create } = setup(t);
  const newest = await create({ media_date: '2026-09-14', title: 'Newest' });
  const middle = await create({ media_date: '2026-09-10', title: 'Middle' });
  const oldest = await create({ media_date: '2026-09-01', title: 'Oldest' });
  const ids = [newest.item.id, middle.item.id, oldest.item.id];
  assert.deepEqual((await request('/api/admin/media?limit=100')).items.map((item) => item.id), ids);
  // Drag oldest to top: manual order wins over dates across the whole scope.
  const manual = [oldest.item.id, middle.item.id, newest.item.id];
  for (const [index, id] of manual.entries()) {
    assert.equal((await request(`/api/admin/media/${id}`, 'PATCH', { manual_order: index * 10 })).status, 200);
  }
  assert.deepEqual((await request('/api/admin/media?limit=100')).items.map((item) => item.id), manual);
  const publicManual = await request('/api/gallery/media?type=image&limit=100');
  assert.deepEqual(publicManual.media.map((item) => item.id), manual);
  assert.ok(publicManual.media.every((item) => Object.hasOwn(item, 'manual_order')));
  // Reset returns the scope to automatic date order.
  for (const id of manual) {
    assert.equal((await request(`/api/admin/media/${id}`, 'PATCH', { manual_order: null })).item.manual_order, null);
  }
  assert.deepEqual((await request('/api/admin/media?limit=100')).items.map((item) => item.id), ids);
  // New file with the newest date inserts at top while old relative order is preserved.
  db.exec(`UPDATE media_items SET manual_order = 0 WHERE id = '${middle.item.id}'`);
  db.exec(`UPDATE media_items SET manual_order = 10 WHERE id = '${oldest.item.id}'`);
  const inserted = await create({ media_date: '2026-09-14', title: 'Inserted' });
  assert.equal(inserted.status, 201);
  db.exec(`UPDATE media_items SET manual_order = 0 WHERE id = '${inserted.item.id}'`);
  db.exec(`UPDATE media_items SET manual_order = 10 WHERE id = '${middle.item.id}'`);
  db.exec(`UPDATE media_items SET manual_order = 20 WHERE id = '${oldest.item.id}'`);
  assert.deepEqual((await request('/api/admin/media?limit=100')).items.map((item) => item.id),
    [inserted.item.id, middle.item.id, oldest.item.id, newest.item.id]);
});

test('migration preserves legacy rows as null', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE media_items (id TEXT PRIMARY KEY); INSERT INTO media_items VALUES (\'legacy\');');
    db.exec(migration);
    db.exec(readFileSync(new URL('./002_manual_order.sql', import.meta.url), 'utf8'));
    const legacy = db.prepare('SELECT media_date, manual_order FROM media_items').get();
    assert.equal(legacy.media_date, null);
    assert.equal(legacy.manual_order, null);
  } finally { db.close(); }
});

test('handoff patch reverses and reapplies exactly to the reference files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'media-date-patch-'));
  const files = ['worker/src/index.ts', 'd1/schema.sql', 'worker/wrangler.toml.example'];
  try {
    mkdirSync(join(dir, 'worker/src'), { recursive: true });
    mkdirSync(join(dir, 'd1'));
    for (const file of files) writeFileSync(join(dir, file), readFileSync(join(root, file)));
    const patch = readFileSync(new URL('./worker.patch', import.meta.url));
    for (const reverse of [true, false]) execFileSync('git', ['apply', ...(reverse ? ['--reverse'] : []), '-'], { cwd: dir, input: patch });
    for (const file of files) assert.equal(readFileSync(join(dir, file), 'utf8'), readFileSync(join(root, file), 'utf8'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
