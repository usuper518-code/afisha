// Каталог админки, длительность mp3 и закрытые служебные пути на базе catalog_suite.
// Рабочая catalog только сверяется по числу строк.
//
//   node tests/api/catalog.mjs

import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = process.env.SUITE_PORT || '8093';
const base = `http://127.0.0.1:${port}`;
const mysql = ['-uroot', '-p12345', '--protocol=tcp', '-h127.0.0.1'];
const failures = [];

function check(name, ok, detail = '') {
  if (ok) console.log('ok', name);
  else {
    const line = detail ? `${name}: ${detail}` : name;
    failures.push(line);
    console.log('FAIL', line);
  }
}

function sql(query, database = 'catalog_suite') {
  return execFileSync('mysql', [...mysql, '-N', '-B', database, '-e', query], { encoding: 'utf8' }).trim();
}

function counts(database) {
  const tables = ['users', 'events', 'reviews', 'ratings', 'reactions', 'premiere_reminders', 'releases'];
  const out = {};
  for (const table of tables) out[table] = sql(`SELECT COUNT(*) FROM \`${table}\``, database);
  return out;
}

function snapshotDir(dir) {
  try { return new Set(readdirSync(dir)); } catch { return new Set(); }
}

function mirrorTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) mirrorTree(from, to);
    else if (entry.name.endsWith('.php')) writeFileSync(to, readFileSync(from));
    else symlinkSync(from, to);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const prodBefore = counts('catalog');
const rateBefore = snapshotDir(path.join(root, 'source/storage/ratelimit'));
const sessionBefore = snapshotDir(path.join(root, 'source/storage/sessions'));

execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite; CREATE DATABASE catalog_suite CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;']);
execFileSync('mysql', [...mysql, 'catalog_suite'], {
  input: readFileSync(path.join(root, 'source/sql/catalog.sql')),
});
sql(`INSERT INTO news (title, content, is_published) VALUES ('suite-marker-catalog', 'метка', 1)`);

const mirror = path.join(root, 'tests/api/.mirror');
rmSync(mirror, { recursive: true, force: true });
mirrorTree(path.join(root, 'source'), mirror);
const configPath = path.join(mirror, 'api/config.php');
rmSync(configPath);
writeFileSync(configPath, readFileSync(path.join(root, 'source/api/config.php'), 'utf8').replace(
  "define('DB_NAME', 'catalog');",
  "define('DB_NAME', 'catalog_suite');",
));

const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', mirror, path.join(mirror, 'router.php')], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let phpLog = '';
php.stderr.on('data', (chunk) => { phpLog += chunk; });
php.stdout.on('data', (chunk) => { phpLog += chunk; });

async function ready() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/news`);
      if (res.status) return;
    } catch { /* ещё стартует */ }
    await sleep(50);
  }
  throw new Error('тестовый сервер не ответил');
}

async function api(method, urlPath, { json, form, key = '12345' } = {}) {
  const headers = { Accept: 'application/json' };
  if (key) headers['X-API-Key'] = key;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (form) body = form;
  const res = await fetch(base + urlPath, { method, headers, body });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: res.status, json: parsed, text, type: res.headers.get('content-type') || '' };
}


function httpGet(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: Number(port), path: urlPath, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        type: res.headers['content-type'] || '',
        range: res.headers['content-range'] || '',
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

try {
  await ready();
  const news = await api('GET', '/api/news', { key: '' });
  const marker = news.json?.data?.find((row) => row.title === 'suite-marker-catalog');
  if (!marker) throw new Error('сервер смотрит не в catalog_suite, записи остановлены');

  check('новости остаются json', news.status === 200 && news.type.includes('application/json'), `${news.status} ${news.type}`);

  writeFileSync(path.join(mirror, 'uploads', 'evil.php'), '<?php echo "PWNED";');
  writeFileSync(path.join(mirror, 'media', 'range-probe.bin'), Buffer.alloc(80, 0x41));
  const hidden = [
    ['/api/config.php', 'DB_PASS'],
    ['/api/functions.php', 'function getDB'],
    ['/api/vendor/getid3/license.txt', 'getID3'],
    ['/api/vendor/TCPDF/tcpdf.php', 'TCPDF'],
    ['/sql/catalog.sql', 'CREATE TABLE'],
    ['/logs/php_errors.log', '[php]'],
    ['/cron/send-reminders.php', 'MAIL_FROM'],
    ['/cron/send-booklets.php', 'MAIL_FROM'],
    ['/router.php', 'betaServeFile'],
    ['/templates/afisha.html.tpl', 'theme-color'],
    ['/storage/sessions/sess_probe', 'client_id'],
    ['/storage/ratelimit/x.json', '"hits"'],
    ['/.htaccess', 'RewriteEngine'],
    ['/uploads/evil.php', 'PWNED'],
  ];
  for (const [urlPath, secret] of hidden) {
    const res = await httpGet(urlPath);
    const leaked = secret !== '' && res.body.includes(secret);
    check(`закрыто ${urlPath}`, (res.status === 403 || res.status === 404) && !leaked, `${res.status} ${res.type} ${res.body.slice(0, 80)}`);
  }

  const directAdmin = await httpGet('/api/admin/releases.php');
  check('прямой скрипт админки без ключа', directAdmin.status === 401 && directAdmin.type.includes('application/json') && !directAdmin.body.includes('DB_PASS'), `${directAdmin.status} ${directAdmin.type} ${directAdmin.body.slice(0, 80)}`);

  const slipped = await httpGet('/api/admin/%2e%2e/config.php');
  check('обход имени обработчика', (slipped.status === 400 || slipped.status === 401 || slipped.status === 404) && !slipped.body.includes('DB_PASS'), `${slipped.status} ${slipped.body.slice(0, 80)}`);

  const map = await httpGet('/api/sitemap');
  check('карта сайта остаётся xml', map.status === 200 && map.type.includes('application/xml') && map.body.includes('<urlset'), `${map.status} ${map.type}`);

  const ranged = await httpGet('/media/range-probe.bin', { Range: 'bytes=0-9' });
  check('range статики', ranged.status === 206 && (ranged.range || '') === 'bytes 0-9/80' && ranged.body === 'A'.repeat(10), `${ranged.status} ${ranged.range} ${ranged.body.length}`);


  const denied = await api('POST', '/api/admin/releases', { key: '', json: { title: 'x', slug: 'x' } });
  check('каталог без ключа', denied.status === 401, JSON.stringify(denied.json));

  const badTheme = await api('POST', '/api/admin/releases', { json: { title: 'Чужой', slug: 'suite-bad', theme: '../default' } });
  check('тема не выходит из каталога', badTheme.status === 422, JSON.stringify(badTheme.json));

  const badYear = await api('POST', '/api/admin/releases', { json: { title: 'Год', slug: 'suite-year', release_year: 1800 } });
  check('год вне диапазона', badYear.status === 422, JSON.stringify(badYear.json));

  const created = await api('POST', '/api/admin/releases', {
    json: {
      title: 'Спектакль <script>',
      slug: 'suite-release',
      subtitle: 'подзаголовок',
      release_year: 2026,
      premiere_date: '2026-12-01',
      type: 'musical',
      theme: 'night',
      is_published: 1,
      is_premiere: 1,
    },
  });
  const releaseId = created.json?.id;
  check('релиз создан', created.status === 201 && releaseId, `${created.status} ${created.text.slice(0, 180)}`);

  const again = await api('POST', '/api/admin/releases', {
    json: { title: 'Другой', slug: 'suite-release', theme: 'default' },
  });
  check('повторный код релиза', again.status === 409, `${again.status} ${again.text.slice(0, 160)}`);

  const page = await api('GET', '/api/admin/releases?offset=-1&search=' + encodeURIComponent('Спектакль'));
  const found = page.json?.data?.find((row) => row.slug === 'suite-release');
  check('список релизов и отрицательный сдвиг', page.status === 200 && found && page.json.total >= 1, `${page.status} ${page.text.slice(0, 160)}`);

  const artist = await api('POST', '/api/admin/artists', { json: { name: 'Голос', slug: 'suite-voice', is_active: 1 } });
  const artistId = artist.json?.id;
  check('артист создан', artist.status === 201 && artistId, `${artist.status} ${artist.text.slice(0, 160)}`);

  const track = await api('POST', '/api/admin/tracks', {
    json: { title: 'Сцена', slug: 'suite-track', lyrics: 'текст сцены', is_published: 1, artist_ids: [artistId] },
  });
  const trackId = track.json?.id;
  check('трек создан', track.status === 201 && trackId, `${track.status} ${track.text.slice(0, 180)}`);

  const linked = await api('PUT', `/api/admin/releases?id=${releaseId}`, {
    json: { tracks: [{ track_id: trackId, track_number: 1 }] },
  });
  const card = await api('GET', `/api/admin/releases?id=${releaseId}`);
  check('трек вошёл в релиз', linked.status === 200 && card.json?.tracks?.some((row) => Number(row.id) === Number(trackId)), `${linked.status} ${JSON.stringify(card.json?.tracks)}`);

  const second = await api('POST', '/api/admin/releases', {
    json: { title: 'Следующий', slug: 'suite-next', theme: 'default', is_premiere: 1 },
  });
  const firstFlag = sql(`SELECT is_premiere FROM releases WHERE slug = 'suite-release'`);
  check('новая премьера гасит прежнюю', second.status === 201 && firstFlag === '0', `${second.status} flag ${firstFlag}`);

  const story = await api('POST', '/api/admin/news', { json: { title: 'Афиша недели', content: 'текст', is_published: 1 } });
  const newsPage = await api('GET', '/api/admin/news?offset=-1&search=' + encodeURIComponent('Афиша'));
  check('новость в списке', story.status === 201 && newsPage.status === 200 && newsPage.json?.data?.some((row) => row.title === 'Афиша недели'), `${story.status} ${newsPage.status} ${newsPage.text.slice(0, 120)}`);

  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1.4', '-c:a', 'libmp3lame', '-b:a', '64k', '/tmp/suite-tone.mp3'], { stdio: 'ignore' });
  const plain = new FormData();
  plain.append('file', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'a.txt');
  const rejected = await api('POST', `/api/admin/upload/audio?id=${trackId}`, { form: plain });
  check('аудио не из mp3', rejected.status === 400, JSON.stringify(rejected.json));

  const mp3 = new FormData();
  mp3.append('file', new Blob([readFileSync('/tmp/suite-tone.mp3')], { type: 'audio/mpeg' }), 'tone.mp3');
  const audio = await api('POST', `/api/admin/upload/audio?id=${trackId}`, { form: mp3 });
  const trackUuid = sql(`SELECT uuid FROM tracks WHERE id = ${trackId}`);
  const audioFile = path.join(mirror, 'uploads/track', trackUuid, 'audio.mp3');
  const duration = Number(sql(`SELECT duration FROM tracks WHERE id = ${trackId}`));
  check('длительность mp3 записана', audio.status === 200 && audio.json?.url === `/uploads/track/${trackUuid}/audio.mp3` && existsSync(audioFile) && duration >= 1 && duration <= 3, `${audio.status} ${audio.text.slice(0, 160)} duration ${duration}`);

  const stamps = await api('GET', `/api/admin/generate_timestamps?id=${trackId}`);
  check('генерации таймкодов нет', stamps.status === 404 && !/whisper/i.test(stamps.text), `${stamps.status} ${stamps.text.slice(0, 160)}`);

  const removed = await api('DELETE', `/api/admin/releases?id=${releaseId}`);
  const gone = sql(`SELECT COUNT(*) FROM releases WHERE id = ${releaseId}`);
  check('релиз удалён', removed.status === 200 && gone === '0', `${removed.status} ${removed.text.slice(0, 120)}`);
} finally {
  php.kill('SIGTERM');
  await sleep(200);
  const prodAfter = counts('catalog');
  const drifted = Object.keys(prodBefore).filter((table) => prodBefore[table] !== prodAfter[table]);
  check('рабочая база не изменилась', drifted.length === 0, drifted.map((table) => `${table} ${prodBefore[table]}->${prodAfter[table]}`).join(', '));
  try { execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite']); } catch { /* уже нет */ }
  rmSync(mirror, { recursive: true, force: true });
  const extra = (dir, before) => {
    try { return readdirSync(dir).filter((name) => !before.has(name)).map((name) => path.join(dir, name)); }
    catch { return []; }
  };
  for (const file of [...extra(path.join(root, 'source/storage/ratelimit'), rateBefore), ...extra(path.join(root, 'source/storage/sessions'), sessionBefore)]) {
    try { unlinkSync(file); } catch { /* нет файла */ }
  }
}

if (failures.length) {
  console.log('ИТОГ FAIL', failures.length);
  for (const line of failures) console.log(' -', line);
  if (phpLog.trim()) console.log(phpLog.slice(-1500));
  process.exit(1);
}
console.log('ИТОГ OK');
