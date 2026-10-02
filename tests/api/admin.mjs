// Админка, генерация страниц, темы и поворот экрана.
// Записи идут в catalog_suite и в каталог-зеркало tests/api/.mirror.
// Рабочая catalog только сверяется по числу строк.
//
//   node tests/api/admin.mjs
//
// Поворот и занавес с reduced-motion смотрят живой сайт BASE
// (по умолчанию http://127.0.0.1:8080) и ничего в базу не пишут.

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = process.env.SUITE_PORT || '8092';
const base = `http://127.0.0.1:${port}`;
const live = process.env.BASE || 'http://127.0.0.1:8080';
const mysql = ['-uroot', '-p12345', '--protocol=tcp', '-h127.0.0.1'];
const failures = [];
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

sql(`INSERT INTO releases (title, slug, subtitle, description, premiere_date, is_published, is_premiere, theme)
  VALUES ('Спектакль <script>alert(1)</script>', 'suite-show', 'подзаголовок', 'описание', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 1, 1, 'default')`);
sql(`INSERT INTO tracks (title, slug, lyrics, duration, is_published) VALUES ('Сцена <i>раз</i>', 'suite-scene', 'текст', 12, 1)`);
sql(`INSERT INTO artists (name, slug) VALUES ('Голос <script>', 'suite-voice')`);
sql(`INSERT INTO track_artists (track_id, artist_id)
  SELECT t.id, a.id FROM tracks t JOIN artists a WHERE t.slug = 'suite-scene' AND a.slug = 'suite-voice'`);
sql(`INSERT INTO release_tracks (release_id, track_id, track_number)
  SELECT r.id, t.id, 1 FROM releases r JOIN tracks t WHERE r.slug = 'suite-show' AND t.slug = 'suite-scene'`);
sql(`INSERT INTO users (client_id, nickname, email) VALUES ('11111111-1111-4111-8111-111111111111', 'Анна', 'anna-suite@example.com')`);
sql(`INSERT INTO reviews (release_id, user_id, content, status)
  SELECT r.id, u.id, 'Ждём модерации', 'pending' FROM releases r JOIN users u
  WHERE r.slug = 'suite-show' AND u.email = 'anna-suite@example.com'`);
sql(`INSERT INTO news (title, content, is_published) VALUES ('suite-marker-admin', 'метка', 1)`);

const releaseId = sql(`SELECT id FROM releases WHERE slug = 'suite-show'`);
const trackId = sql(`SELECT id FROM tracks WHERE slug = 'suite-scene'`);
const artistId = sql(`SELECT id FROM artists WHERE slug = 'suite-voice'`);
const reviewId = sql(`SELECT id FROM reviews WHERE content = 'Ждём модерации'`);

const mirror = path.join(root, 'tests/api/.mirror');
rmSync(mirror, { recursive: true, force: true });
mirrorTree(path.join(root, 'source'), mirror);
const configPath = path.join(mirror, 'api/config.php');
rmSync(configPath);
writeFileSync(configPath, readFileSync(path.join(root, 'source/api/config.php'), 'utf8').replace(
  "define('DB_NAME', 'catalog');",
  "define('DB_NAME', 'catalog_suite');",
));
for (const name of ['index.html', 'about.html', '404.html']) {
  rmSync(path.join(mirror, name), { force: true });
}

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
  return { status: res.status, json: parsed, text };
}

function formFile(bytes, name, type) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  return form;
}

try {
  await ready();
  const news = await api('GET', '/api/news', { key: '' });
  const marker = news.json?.data?.find((row) => row.title === 'suite-marker-admin');
  if (!marker) throw new Error('сервер смотрит не в catalog_suite, записи остановлены');

  const denied = await api('GET', '/api/admin/reviews', { key: '' });
  check('модерация без ключа', denied.status === 401, JSON.stringify(denied.json));

  const list = await api('GET', '/api/admin/reviews?status=pending');
  check('список отзывов и счётчик', list.status === 200 && list.json?.total === 1 && list.json?.data?.length === 1, `${list.status} ${list.text.slice(0, 200)}`);

  const badPage = await api('GET', '/api/admin/reviews?offset=-1');
  check('отрицательный сдвиг модерации', badPage.status === 200, `${badPage.status} ${badPage.text.slice(0, 160)}`);

  const badStatus = await api('PUT', `/api/admin/reviews?id=${reviewId}`, { json: { status: 'published' } });
  check('чужой статус отзыва', badStatus.status === 400, JSON.stringify(badStatus.json));

  const approved = await api('PUT', `/api/admin/reviews?id=${reviewId}`, { json: { status: 'approved' } });
  check('отзыв одобрен', approved.status === 200 && sql(`SELECT status FROM reviews WHERE id = ${reviewId}`) === 'approved', JSON.stringify(approved.json));

  const plain = await api('POST', `/api/admin/upload/release_cover?id=${releaseId}`, { form: formFile(Buffer.from('hello'), 'a.txt', 'text/plain') });
  check('обложка не из картинки', plain.status === 400, JSON.stringify(plain.json));

  const cover = await api('POST', `/api/admin/upload/release_cover?id=${releaseId}`, { form: formFile(png, 'dot.png', 'image/png') });
  const releaseUuid = sql(`SELECT uuid FROM releases WHERE id = ${releaseId}`);
  const coverFile = path.join(mirror, 'uploads/release', releaseUuid, 'cover.jpg');
  check('обложка релиза сохранена', cover.status === 200 && cover.json?.url?.includes(releaseUuid) && existsSync(coverFile), JSON.stringify(cover.json));

  const avatar = await api('POST', `/api/admin/upload/artist_cover?id=${artistId}`, { form: formFile(png, 'dot.png', 'image/png') });
  const artistUuid = sql(`SELECT uuid FROM artists WHERE id = ${artistId}`);
  const avatarFile = path.join(mirror, 'uploads/artist', artistUuid, 'avatar.jpg');
  check('фото артиста лежит как аватар', avatar.status === 200 && avatar.json?.url?.endsWith('/avatar.jpg') && existsSync(avatarFile), JSON.stringify(avatar.json));

  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=16x16:d=0.2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-t', '0.2', '/tmp/tiny-suite.mp4'], { stdio: 'ignore' });
  const video = await api('POST', `/api/admin/upload/track_video?id=${trackId}`, {
    form: formFile(readFileSync('/tmp/tiny-suite.mp4'), 'clip.mp4', 'video/mp4'),
  });
  const trackUuid = sql(`SELECT uuid FROM tracks WHERE id = ${trackId}`);
  check('адрес ролика ведёт на видео', video.status === 200 && video.json?.url === `/uploads/track/${trackUuid}/video.mp4` && existsSync(path.join(mirror, 'uploads/track', trackUuid, 'video.mp4')), JSON.stringify(video.json));

  const generated = await api('GET', `/api/admin/generate_album?id=${releaseId}`);
  const indexHtml = existsSync(path.join(mirror, 'index.html')) ? readFileSync(path.join(mirror, 'index.html'), 'utf8') : '';
  const albumHtml = existsSync(path.join(mirror, 'albums/suite-show/index.html'))
    ? readFileSync(path.join(mirror, 'albums/suite-show/index.html'), 'utf8') : '';
  check('генерация отвечает', generated.status === 200 && generated.json?.success === true, `${generated.status} ${generated.text.slice(0, 180)}`);
  check('название экранировано', albumHtml.includes('&lt;script&gt;') && !albumHtml.includes('<script>alert'), albumHtml.slice(0, 120));
  check('афиша собрана', indexHtml.includes('suite-show') && existsSync(path.join(mirror, 'albums/suite-show/track-1.html')) && existsSync(path.join(mirror, 'albums/suite-show/after.html')));

  const themes = readdirSync(path.join(root, 'source/css/themes')).filter((name) => name.startsWith('theme-') && name.endsWith('.css'));
  const pixels = {};
  let puppeteer;
  try {
    puppeteer = await import(pathToFileURL(path.join(root, 'tests/client/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href);
  } catch {
    puppeteer = await import(pathToFileURL('/tmp/client-suite/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js').href);
  }
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 700 });
    for (const file of themes) {
      const theme = file.slice('theme-'.length, -'.css'.length);
      sql(`UPDATE releases SET theme = '${theme}' WHERE id = ${releaseId}`);
      const again = await api('GET', `/api/admin/generate_album?id=${releaseId}`);
      if (again.status !== 200) {
        check(`тема ${theme} генерируется`, false, again.text.slice(0, 160));
        continue;
      }
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      const looked = await page.evaluate(() => ({
        href: document.querySelector('link[href*="/css/themes/"]')?.getAttribute('href') || '',
        bg: getComputedStyle(document.documentElement).getPropertyValue('--theme-color-bg').trim(),
        fabric: getComputedStyle(document.documentElement).getPropertyValue('--theme-curtain-fabric').trim(),
      }));
      const css = readFileSync(path.join(root, 'source/css/themes', file), 'utf8');
      const expected = (css.match(/--theme-color-bg\s*:\s*([^;]+);/) || [])[1]?.trim();
      check(`тема ${theme} на странице`, looked.href.includes(file) && looked.bg.toLowerCase() === expected.toLowerCase(), JSON.stringify(looked));
      const pixel = await page.evaluate(() => {
        const canvas = document.getElementById('curtain-canvas');
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const scale = canvas.width / Math.max(canvas.clientWidth, 1);
        const data = ctx.getImageData(Math.floor(16 * scale), Math.floor(canvas.height / 2), 1, 1).data;
        return [data[0], data[1], data[2]];
      });
      pixels[theme] = pixel;
      check(`занавес ${theme} нарисован`, Array.isArray(pixel) && pixel.some((channel) => channel > 20), JSON.stringify(pixel));
    }
    const differ = (a, b) => a && b && a.some((channel, i) => Math.abs(channel - b[i]) > 20);
    check('темы красят занавес по-разному', differ(pixels.night, pixels.ember) && differ(pixels.ghost, pixels['art-rock']), JSON.stringify({
      night: pixels.night, ember: pixels.ember, ghost: pixels.ghost, art: pixels['art-rock'],
    }));

    const orient = await browser.newPage();
    await orient.setViewport({ width: 1100, height: 700, hasTouch: true });
    await orient.goto(live + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await orient.evaluate(() => {
      const panel = document.getElementById('panel-coming');
      const card = panel && panel.querySelector('.poster-card');
      if (!card) return;
      for (let i = 0; i < 3; i += 1) panel.appendChild(card.cloneNode(true));
    });
    await orient.setViewport({ width: 390, height: 844, hasTouch: true });
    await sleep(400);
    const portrait = await orient.evaluate(() => {
      const spreads = [...document.querySelectorAll('#panel-coming > .spread')];
      return {
        matches: matchMedia('(orientation: portrait)').matches,
        per: spreads.map((spread) => spread.querySelectorAll(':scope > .poster-card').length),
      };
    });
    check('портрет без искусственного события', portrait.matches && portrait.per.length >= 2 && portrait.per.every((n) => n === 1), JSON.stringify(portrait));
    const firstTitle = await orient.evaluate(() => document.querySelector('#panel-coming > .spread.active .poster-card')?.innerText?.slice(0, 40) || '');
    await orient.setViewport({ width: 900, height: 500, hasTouch: true });
    await sleep(400);
    const landscape = await orient.evaluate(() => {
      const spreads = [...document.querySelectorAll('#panel-coming > .spread')];
      return {
        matches: matchMedia('(orientation: portrait)').matches,
        per: spreads.map((spread) => spread.querySelectorAll(':scope > .poster-card').length),
        title: document.querySelector('#panel-coming > .spread.active .poster-card')?.innerText?.slice(0, 40) || '',
      };
    });
    check('альбом собирает пары', !landscape.matches && landscape.per.some((n) => n === 2), JSON.stringify(landscape));
    check('поворот оставляет открытую карточку', landscape.title && landscape.title === firstTitle, JSON.stringify({ firstTitle, landscape: landscape.title }));

    await orient.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await orient.reload({ waitUntil: 'domcontentloaded' });
    const started = Date.now();
    await orient.click('#curtain-canvas');
    let openedFast = false;
    while (Date.now() - started < 700) {
      const alpha = await orient.evaluate(() => {
        const canvas = document.getElementById('curtain-canvas');
        const ctx = canvas.getContext('2d');
        const scale = canvas.width / Math.max(canvas.clientWidth, 1);
        return ctx.getImageData(Math.floor(canvas.clientWidth / 2 * scale), Math.floor(canvas.clientHeight / 2 * scale), 1, 1).data[3];
      });
      if (alpha < 40) { openedFast = true; break; }
      await sleep(40);
    }
    check('reduced-motion открывает занавес сразу', openedFast, `за ${Date.now() - started} мс`);
  } finally {
    await browser.close();
  }
} finally {
  php.kill('SIGTERM');
  await sleep(200);
  const prodAfter = counts('catalog');
  const drifted = Object.keys(prodBefore).filter((table) => prodBefore[table] !== prodAfter[table]);
  check('рабочая база не изменилась', drifted.length === 0, drifted.map((table) => `${table} ${prodBefore[table]}->${prodAfter[table]}`).join(', '));
  try { execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite']); } catch { /* уже нет */ }
  rmSync(mirror, { recursive: true, force: true });
  const { unlinkSync } = await import('node:fs');
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
