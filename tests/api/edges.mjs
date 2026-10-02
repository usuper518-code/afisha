// Оставшиеся ветки на catalog_suite: письмо со ссылкой на буклет,
// черновики новости и спектакля, инструментал, кавер, занятый код,
// клики админки. Рабочая catalog только сверяется по числу строк.
//
//   node tests/api/edges.mjs

import { spawn, execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = process.env.SUITE_PORT || '8096';
const base = `http://127.0.0.1:${port}`;
const mysql = ['-uroot', '-p12345', '--protocol=tcp', '-h127.0.0.1'];
const failures = [];
const copyExt = new Set(['.php', '.css', '.js', '.mjs', '.html', '.woff', '.woff2']);
const mailBox = '/tmp/suite-edge-mail';
const mailFrom = 'studio@example.com';
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
    else if (copyExt.has(path.extname(entry.name).toLowerCase())) writeFileSync(to, readFileSync(from));
    else symlinkSync(from, to);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeConfig(from) {
  let text = readFileSync(path.join(root, 'source/api/config.php'), 'utf8').replace(
    "define('DB_NAME', 'catalog');",
    "define('DB_NAME', 'catalog_suite');",
  );
  if (from) text = text.replace("define('MAIL_FROM', '');", `define('MAIL_FROM', '${from}');`);
  writeFileSync(configPath, text);
}

function clearMail() {
  rmSync(mailBox, { recursive: true, force: true });
  mkdirSync(mailBox, { recursive: true });
}

function readMail() {
  return readdirSync(mailBox).sort().map((name) => readFileSync(path.join(mailBox, name), 'utf8'));
}

const prodBefore = counts('catalog');
const rateBefore = snapshotDir(path.join(root, 'source/storage/ratelimit'));
const sessionBefore = snapshotDir(path.join(root, 'source/storage/sessions'));

execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite; CREATE DATABASE catalog_suite CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;']);
execFileSync('mysql', [...mysql, 'catalog_suite'], {
  input: readFileSync(path.join(root, 'source/sql/catalog.sql')),
});
sql(`INSERT INTO news (title, content, is_published) VALUES ('suite-marker-edges', 'метка', 1)`);

const mirror = path.join(root, 'tests/api/.mirror');
rmSync(mirror, { recursive: true, force: true });
mirrorTree(path.join(root, 'source'), mirror);
const configPath = path.join(mirror, 'api/config.php');
rmSync(configPath);
writeConfig('');
for (const name of ['index.html', 'about.html', '404.html']) {
  rmSync(path.join(mirror, name), { force: true });
}

const capture = '/tmp/suite-edge-mail.py';
writeFileSync(capture, [
  '#!/usr/bin/env python3',
  'import pathlib, sys, time',
  `box = pathlib.Path(${JSON.stringify(mailBox)})`,
  'box.mkdir(parents=True, exist_ok=True)',
  'name = str(time.time_ns()) + ".eml"',
  '(box / name).write_bytes(sys.stdin.buffer.read())',
  '',
].join('\n'));
chmodSync(capture, 0o755);
clearMail();

let php;
let phpLog = '';

function startPhp() {
  phpLog = '';
  php = spawn('php', [
    '-d', `sendmail_path=${capture}`,
    '-S', `127.0.0.1:${port}`,
    '-t', mirror,
    path.join(mirror, 'router.php'),
  ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  php.stderr.on('data', (chunk) => { phpLog += chunk; });
  php.stdout.on('data', (chunk) => { phpLog += chunk; });
}

function stopPhp() {
  return new Promise((resolve) => {
    if (!php) return resolve();
    const child = php;
    php = null;
    const done = () => resolve();
    child.once('exit', done);
    child.kill('SIGTERM');
    setTimeout(done, 1500);
  });
}

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

const jars = new Map();
async function api(method, urlPath, { json, form, key, jar } = {}) {
  const headers = { Accept: 'application/json' };
  if (key) headers['X-API-Key'] = key;
  if (jar && jars.has(jar)) headers.Cookie = jars.get(jar);
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (form) body = form;
  const res = await fetch(base + urlPath, { method, headers, body });
  if (jar) {
    const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    const raw = setCookie.length ? setCookie : [res.headers.get('set-cookie')].filter(Boolean);
    if (raw.length) {
      const prev = new Map((jars.get(jar) || '').split('; ').filter(Boolean).map((pair) => {
        const eq = pair.indexOf('=');
        return [pair.slice(0, eq), pair.slice(eq + 1)];
      }));
      for (const line of raw) {
        const part = line.split(';')[0];
        const eq = part.indexOf('=');
        if (eq > 0) prev.set(part.slice(0, eq), part.slice(eq + 1));
      }
      jars.set(jar, [...prev].map(([name, value]) => `${name}=${value}`).join('; '));
    }
  }
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: res.status, json: parsed, text, type: res.headers.get('content-type') || '' };
}

function admin(method, urlPath, opts = {}) {
  return api(method, urlPath, { ...opts, key: '12345' });
}

async function release(title, slug, extra = {}) {
  const res = await admin('POST', '/api/admin/releases', {
    json: {
      title, slug, theme: 'default', is_published: 1, is_premiere: 0, release_year: 2026,
      subtitle: 'подзаголовок', description: 'описание', ...extra,
    },
  });
  return { res, id: res.json?.id };
}

try {
  startPhp();
  await ready();
  const news = await api('GET', '/api/news');
  const marker = news.json?.data?.find((row) => row.title === 'suite-marker-edges');
  if (!marker) throw new Error('сервер смотрит не в catalog_suite, записи остановлены');

  const committed = readFileSync(path.join(root, 'source/api/config.php'), 'utf8');
  check('боевой адрес отправителя пуст', committed.includes("define('MAIL_FROM', '');"));

  const edge = await release('Край спектакля', 'suite-edge-show');
  const live = await release('Живой спектакль', 'suite-live-show', { premiere_date: '2026-12-01' });
  const draft = await release('Черновой спектакль', 'suite-draft-show', { is_published: 0 });
  check('три спектакля созданы', edge.res.status === 201 && live.res.status === 201 && draft.res.status === 201, [edge, live, draft].map((row) => `${row.res.status} ${row.res.text.slice(0, 80)}`).join(' | '));

  const story = await admin('POST', '/api/admin/news', { json: { title: 'Черновик края', content: 'ещё не в ленте', is_published: 0 } });
  const hiddenNews = await api('GET', '/api/news');
  check('черновик новости скрыт', story.status === 201 && hiddenNews.status === 200 && !hiddenNews.json?.data?.some((row) => row.title === 'Черновик края'), `${story.status} ${JSON.stringify(hiddenNews.json)}`);
  const publishNews = await admin('PUT', `/api/admin/news?id=${story.json?.id}`, { json: { is_published: 1 } });
  const shownNews = await api('GET', '/api/news');
  check('новость вернулась в ленту', publishNews.status === 200 && shownNews.json?.data?.some((row) => row.title === 'Черновик края' && row.content === 'ещё не в ленте'), `${publishNews.status} ${JSON.stringify(shownNews.json)}`);

  const mapHidden = await api('GET', '/api/sitemap');
  check('черновик отсутствует в карте', mapHidden.status === 200 && mapHidden.type.includes('application/xml') && mapHidden.text.includes('<urlset') && mapHidden.text.includes('https://site/albums/suite-live-show/') && mapHidden.text.includes('<lastmod>2026-12-01</lastmod>') && mapHidden.text.includes('https://site/albums/suite-edge-show/') && !mapHidden.text.includes('suite-draft-show') && !mapHidden.text.includes('1970-01-01'), `${mapHidden.status} ${mapHidden.type} ${mapHidden.text.slice(0, 400)}`);

  const booklet = await admin('GET', `/api/admin/generate_album?id=${edge.id}`);
  const pdfPath = path.join(mirror, 'albums/suite-edge-show/booklet.pdf');
  const pdfHead = existsSync(pdfPath) ? readFileSync(pdfPath).subarray(0, 4).toString() : '';
  check('буклет собран', booklet.status === 200 && booklet.json?.success === true && pdfHead === '%PDF', `${booklet.status} ${booklet.text.slice(0, 180)} ${pdfHead}`);

  const poster = await admin('GET', `/api/admin/generate_album?id=${live.id}`);
  const indexHidden = existsSync(path.join(mirror, 'index.html')) ? readFileSync(path.join(mirror, 'index.html'), 'utf8') : '';
  check('черновик не на афише', poster.status === 200 && indexHidden.includes('/albums/suite-live-show/') && !indexHidden.includes('suite-draft-show'), `${poster.status} ${poster.text.slice(0, 160)}`);

  const publishShow = await admin('PUT', `/api/admin/releases?id=${draft.id}`, { json: { is_published: 1 } });
  const mapShown = await api('GET', '/api/sitemap');
  check('спектакль появился в карте', publishShow.status === 200 && mapShown.text.includes('https://site/albums/suite-draft-show/'), `${publishShow.status} ${mapShown.text.includes('suite-draft-show')}`);
  const posterAgain = await admin('GET', `/api/admin/generate_album?id=${live.id}`);
  const indexShown = readFileSync(path.join(mirror, 'index.html'), 'utf8');
  check('спектакль появился на афише', posterAgain.status === 200 && indexShown.includes('suite-draft-show') && indexShown.includes('suite-live-show'), String(posterAgain.status));

  const silent = await api('POST', '/api/feedback', {
    jar: 'zritel',
    json: {
      release_id: Number(edge.id), name: 'Зритель Края', review: 'Отзыв на одобрение',
      email: 'zritel-edge@example.com', want_booklet: true, subscribe: false,
    },
  });
  check('без отправителя письмо не уходит', silent.status === 200 && silent.json?.success === true && readMail().length === 0, `${silent.status} ${silent.text.slice(0, 120)} писем ${readMail().length}`);

  await stopPhp();
  writeConfig(mailFrom);
  clearMail();
  startPhp();
  await ready();

  const sent = await api('POST', '/api/feedback', {
    jar: 'zritel',
    json: {
      release_id: Number(edge.id), name: 'Зритель Края', review: 'Отзыв на одобрение',
      email: 'zritel-edge@example.com', want_booklet: true, subscribe: false,
    },
  });
  const subscribed = await api('POST', '/api/feedback', {
    jar: 'podpis',
    json: {
      release_id: Number(edge.id), name: 'Подписчик Края', review: 'Отзыв на отказ',
      email: 'podpis-edge@example.com', want_booklet: true, subscribe: true,
    },
  });
  const letters = readMail();
  const bookletUrl = 'https://site/albums/suite-edge-show/booklet.pdf';
  const plain = letters.find((letter) => letter.includes('Зритель Края') && !letter.includes('Подписчик Края'));
  const listed = letters.find((letter) => letter.includes('Подписчик Края'));
  check('письма ушли', sent.status === 200 && subscribed.status === 200 && letters.length === 2, `${sent.status} ${subscribed.status} писем ${letters.length} ${letters.join('\n---\n').slice(0, 500)}`);
  check('в письме ссылка на буклет', !!plain && plain.includes(bookletUrl) && plain.includes('Край спектакля') && plain.includes(`From: ${mailFrom}`) && !plain.includes('Вы подписаны на рассылку'), (plain || '').slice(0, 500));
  check('подписка упомянута отдельно', !!listed && listed.includes(bookletUrl) && listed.includes('Вы подписаны на рассылку анонсов'), (listed || '').slice(0, 400));

  const bare = await admin('POST', '/api/admin/tracks', { json: { title: 'Без текста', slug: 'suite-bare' } });
  check('текст обязателен', bare.status === 422 && bare.text.includes('текст') && sql(`SELECT COUNT(*) FROM tracks WHERE slug = 'suite-bare'`) === '0', `${bare.status} ${bare.text.slice(0, 180)}`);

  const instrumental = await admin('POST', '/api/admin/tracks', {
    json: { title: 'Альфа сцена', slug: 'suite-alpha', is_instrumental: 1, is_published: 1 },
  });
  const alpha = await admin('GET', `/api/admin/tracks?id=${instrumental.json?.id}`);
  check('инструментал без текста', instrumental.status === 201 && Number(alpha.json?.is_instrumental) === 1 && (alpha.json?.lyrics ?? '') === '', `${instrumental.status} ${alpha.text.slice(0, 200)}`);

  const cover = await admin('POST', '/api/admin/tracks', {
    json: { title: 'Бета сцена', slug: 'suite-beta', lyrics: 'кавер', original_track_id: instrumental.json?.id, is_published: 1 },
  });
  const beta = await admin('GET', `/api/admin/tracks?id=${cover.json?.id}`);
  check('кавер ссылается на оригинал', cover.status === 201 && Number(beta.json?.original_track_id) === Number(instrumental.json?.id), `${cover.status} ${beta.text.slice(0, 200)}`);

  const yarus = await admin('POST', '/api/admin/tracks', {
    json: { title: 'Ярус сцена', slug: 'suite-yarus', lyrics: 'строка', is_published: 1 },
  });
  const dupTrack = await admin('POST', '/api/admin/tracks', {
    json: { title: 'Другая сцена', slug: 'suite-alpha', lyrics: 'ещё', is_published: 1 },
  });
  check('занятый код трека', yarus.status === 201 && dupTrack.status === 409, `${yarus.status} ${dupTrack.status} ${dupTrack.text.slice(0, 120)}`);

  const artist = await admin('POST', '/api/admin/artists', { json: { name: 'Голос края', slug: 'suite-voice', is_active: 1 } });
  const dupArtist = await admin('POST', '/api/admin/artists', { json: { name: 'Другой голос', slug: 'suite-voice', is_active: 1 } });
  check('занятый код артиста', artist.status === 201 && dupArtist.status === 409, `${artist.status} ${dupArtist.status} ${dupArtist.text.slice(0, 120)}`);

  const have = Number(sql('SELECT COUNT(*) FROM releases'));
  for (let i = have; i < 11; i += 1) {
    const filler = await release(`Лист ${String(i).padStart(2, '0')}`, `suite-list-${i}`);
    if (filler.res.status !== 201) check('добор страницы релизов', false, filler.res.text.slice(0, 160));
  }
  check('релизов хватает на две страницы', Number(sql('SELECT COUNT(*) FROM releases')) >= 11, sql('SELECT COUNT(*) FROM releases'));

  const approveId = sql(`SELECT id FROM reviews WHERE content = 'Отзыв на одобрение'`);
  const rejectId = sql(`SELECT id FROM reviews WHERE content = 'Отзыв на отказ'`);

  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=0.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '/tmp/suite-edge.mp4'], { stdio: 'ignore' });
  writeFileSync('/tmp/suite-edge.png', png);
  const clipMime = execFileSync('file', ['-b', '--mime-type', '/tmp/suite-edge.mp4'], { encoding: 'utf8' }).trim();
  check('ролик распознаётся как mp4', clipMime === 'video/mp4', clipMime);

  const puppeteerFiles = [
    path.join(root, 'tests/client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    '/tmp/client-suite/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ];
  const puppeteerFile = puppeteerFiles.find((file) => existsSync(file));
  if (!puppeteerFile) throw new Error('puppeteer-core не найден');
  const puppeteer = await import(pathToFileURL(puppeteerFile).href);
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/admin/login.html`, { waitUntil: 'domcontentloaded' });
    await page.type('#api-key', '12345');
    await page.click('#login-form button');
    await page.waitForFunction(() => document.body.innerText.includes('Всего прослушиваний'), { timeout: 8000 });

    await page.goto(`${base}/admin/reviews.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`[data-action="approve"][data-id="${approveId}"]`, { timeout: 8000 });
    await page.click(`[data-action="approve"][data-id="${approveId}"]`);
    await page.waitForSelector('.confirm-message');
    const approveText = await page.$eval('.confirm-message', (el) => el.textContent);
    check('спрос перед одобрением', approveText.includes('одобрить'), approveText);
    await page.click('.confirm-overlay [data-action="confirm"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.review-card')].some((card) => card.innerText.includes('Отзыв на одобрение') && card.innerText.includes('Одобрен')), { timeout: 8000 });
    check('отзыв одобрен', sql(`SELECT status FROM reviews WHERE id = ${approveId}`) === 'approved', sql(`SELECT status FROM reviews WHERE id = ${approveId}`));

    await page.click(`[data-action="reject"][data-id="${rejectId}"]`);
    await page.waitForSelector('.confirm-message');
    const rejectText = await page.$eval('.confirm-message', (el) => el.textContent);
    check('спрос перед отказом', rejectText.includes('отклонить'), rejectText);
    await page.click('.confirm-overlay [data-action="confirm"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.review-card')].some((card) => card.innerText.includes('Отзыв на отказ') && card.innerText.includes('Отклонён')), { timeout: 8000 });
    check('отзыв отклонён', sql(`SELECT status FROM reviews WHERE id = ${rejectId}`) === 'rejected', sql(`SELECT status FROM reviews WHERE id = ${rejectId}`));

    await page.goto(`${base}/admin/tracks.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#data-table')?.innerText.includes('Ярус сцена'), { timeout: 8000 });
    await page.click('th[data-field="title"]');
    await page.waitForFunction(() => document.querySelector('#data-table tr td a')?.textContent.trim() === 'Альфа сцена', { timeout: 8000 });
    await page.click('th[data-field="title"]');
    await page.waitForFunction(() => document.querySelector('#data-table tr td a')?.textContent.trim() === 'Ярус сцена', { timeout: 8000 });
    check('сортировка названия туда и обратно', true);

    await page.type('#search-input', 'Ярус');
    await page.click('#search-btn');
    await page.waitForFunction(() => {
      const text = document.querySelector('#data-table')?.innerText || '';
      return text.includes('Ярус сцена') && !text.includes('Альфа сцена');
    }, { timeout: 8000 });
    await page.click('#reset-search-btn');
    await page.waitForFunction(() => document.querySelector('#data-table')?.innerText.includes('Альфа сцена'), { timeout: 8000 });
    check('поиск трека и сброс', true);

    const clickDelete = (title) => page.evaluate((title) => {
      const btn = [...document.querySelectorAll('#data-table .delete-btn')].find((el) => el.dataset.title === title);
      if (!btn) return false;
      btn.click();
      return true;
    }, title);
    check('кнопка удаления на месте', await clickDelete('Бета сцена'));
    await page.waitForSelector('.confirm-message');
    const deleteText = await page.$eval('.confirm-message', (el) => el.textContent);
    check('удаление спрашивает название', deleteText.includes('Бета сцена') && deleteText.includes('Удалить'), deleteText);
    await page.click('.confirm-overlay [data-action="cancel"]');
    await page.waitForFunction(() => !document.querySelector('.confirm-overlay'));
    check('отмена оставляет трек', sql(`SELECT COUNT(*) FROM tracks WHERE slug = 'suite-beta'`) === '1' && await page.evaluate(() => document.querySelector('#data-table').innerText.includes('Бета сцена')));
    check('повторное удаление', await clickDelete('Бета сцена'));
    await page.waitForSelector('.confirm-overlay [data-action="confirm"]');
    await page.click('.confirm-overlay [data-action="confirm"]');
    await page.waitForFunction(() => !document.querySelector('#data-table').innerText.includes('Бета сцена'), { timeout: 8000 });
    check('трек удалён после согласия', sql(`SELECT COUNT(*) FROM tracks WHERE slug = 'suite-beta'`) === '0');

    await page.goto(`${base}/admin/releases.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const total = Number((document.querySelector('#total-info')?.textContent.match(/\d+/) || [])[0] || 0);
      return total > 10 && document.querySelector('a[data-page="2"]');
    }, { timeout: 8000 });
    const firstPage = await page.$$eval('#data-table tr', (rows) => rows.map((row) => row.innerText));
    await page.click('a[data-page="2"]');
    await page.waitForFunction(() => document.querySelector('#pagination .current')?.textContent === '2', { timeout: 8000 });
    const secondPage = await page.$$eval('#data-table tr', (rows) => rows.map((row) => row.innerText));
    check('вторая страница другая', secondPage.length > 0 && firstPage.length > 0 && secondPage[0] !== firstPage[0] && !secondPage.includes(firstPage[0]), `${firstPage[0]} -> ${secondPage[0]}`);

    const yarusId = yarus.json.id;
    await page.goto(`${base}/admin/track-form.html?id=${yarusId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('title')?.value === 'Ярус сцена', { timeout: 8000 });
    await page.click('#btn-media-video');
    const videoInput = await page.$('#video-file');
    await videoInput.uploadFile('/tmp/suite-edge.mp4');
    await page.waitForFunction(() => document.body.innerText.includes('Файл загружен'), { timeout: 8000 });
    const yarusUuid = sql(`SELECT uuid FROM tracks WHERE id = ${yarusId}`);
    const videoPath = path.join(mirror, 'uploads/track', yarusUuid, 'video.mp4');
    const videoHead = existsSync(videoPath) ? readFileSync(videoPath).subarray(0, 16).toString('latin1') : '';
    check('видео с формы сохранено', existsSync(videoPath) && videoHead.includes('ftyp'), videoHead);
    const pngInput = await page.$('#video-file');
    await pngInput.uploadFile('/tmp/suite-edge.png');
    await page.waitForFunction(() => document.body.innerText.includes('Неверный тип файла'), { timeout: 8000 });
    const videoAfter = readFileSync(videoPath).subarray(0, 16).toString('latin1');
    check('чужой файл не затирает видео', videoAfter.includes('ftyp') && !videoAfter.startsWith('\u0089PNG'), videoAfter);
  } finally {
    await browser.close();
  }
} finally {
  await stopPhp();
  const prodAfter = counts('catalog');
  const drifted = Object.keys(prodBefore).filter((table) => prodBefore[table] !== prodAfter[table]);
  check('рабочая база не изменилась', drifted.length === 0, drifted.map((table) => `${table} ${prodBefore[table]}->${prodAfter[table]}`).join(', '));
  let leaked = '0';
  try { leaked = sql(`SELECT COUNT(*) FROM users WHERE email LIKE '%-edge@example.com'`, 'catalog'); } catch { leaked = 'err'; }
  check('почта прогона не в рабочей базе', leaked === '0', leaked);
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
  if (phpLog.trim()) console.log(phpLog.slice(-2000));
  process.exit(1);
}
console.log('ИТОГ OK');
