// Публичное API и рассылка напоминаний на отдельной базе catalog_suite.
// Рабочая база catalog только считывается счётчиками до и после: записей
// туда этот прогон не делает.
//
//   node tests/api/public.mjs
//
// Нужны mysql-клиент и php в PATH. Креды совпадают с source/api/config.php.

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
const port = process.env.SUITE_PORT || '8091';
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
  return execFileSync('mysql', [...mysql, '-N', '-B', database, '-e', query], {
    encoding: 'utf8',
  }).trim();
}

function counts(database) {
  const tables = ['users', 'events', 'reviews', 'ratings', 'reactions', 'premiere_reminders', 'releases'];
  const out = {};
  for (const table of tables) {
    out[table] = sql(`SELECT COUNT(*) FROM \`${table}\``, database);
  }
  return out;
}

function snapshotDir(dir) {
  try {
    return new Set(readdirSync(dir));
  } catch {
    return new Set();
  }
}

function extraFiles(dir, before) {
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((name) => !before.has(name)).map((name) => path.join(dir, name));
}

const prodBefore = counts('catalog');
const rateBefore = snapshotDir(path.join(root, 'source/storage/ratelimit'));
const sessionBefore = snapshotDir(path.join(root, 'source/storage/sessions'));

execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite; CREATE DATABASE catalog_suite CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;']);
execFileSync('mysql', [...mysql, 'catalog_suite'], {
  input: execFileSync('cat', [path.join(root, 'source/sql/catalog.sql')]),
});

sql(`INSERT INTO releases (title, slug, premiere_date, is_published, theme) VALUES
  ('Будущий спектакль', 'suite-future', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 1, 'default'),
  ('Завтрашний', 'suite-tomorrow', DATE_ADD(CURDATE(), INTERVAL 1 DAY), 1, 'default'),
  ('Прошедший', 'suite-past', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 1, 'default')`);
sql(`INSERT INTO tracks (title, slug, lyrics, is_published) VALUES ('Сцена', 'suite-track', 'текст', 1)`);
sql(`INSERT INTO release_tracks (release_id, track_id, track_number)
  SELECT r.id, t.id, 1 FROM releases r JOIN tracks t
  WHERE r.slug = 'suite-past' AND t.slug = 'suite-track'`);
sql(`INSERT INTO news (title, content, is_published) VALUES ('suite-marker-7f3a', '<img src=x onerror=alert(1)>', 1)`);

const futureId = sql(`SELECT id FROM releases WHERE slug = 'suite-future'`);
const tomorrowId = sql(`SELECT id FROM releases WHERE slug = 'suite-tomorrow'`);
const pastId = sql(`SELECT id FROM releases WHERE slug = 'suite-past'`);
const trackId = sql(`SELECT id FROM tracks WHERE slug = 'suite-track'`);

const mirror = path.join(root, 'tests/api/.mirror');
rmSync(mirror, { recursive: true, force: true });
mirrorTree(path.join(root, 'source'), mirror);
const configPath = path.join(mirror, 'api/config.php');
rmSync(configPath);
writeFileSync(configPath, readFileSync(path.join(root, 'source/api/config.php'), 'utf8').replace(
  "define('DB_NAME', 'catalog');",
  "define('DB_NAME', 'catalog_suite');",
));

const php = spawn('php', [
  '-S', `127.0.0.1:${port}`,
  '-t', mirror,
  path.join(mirror, 'router.php'),
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let phpLog = '';
php.stderr.on('data', (chunk) => { phpLog += chunk; });
php.stdout.on('data', (chunk) => { phpLog += chunk; });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ready() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/news`);
      if (res.status) return;
    } catch { /* сервер ещё поднимается */ }
    await sleep(50);
  }
  throw new Error('тестовый сервер не ответил');
}

const jars = new Map();
async function api(name, method, urlPath, body) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (jars.has(name)) headers.Cookie = jars.get(name);
  const res = await fetch(base + urlPath, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const raw = setCookie.length ? setCookie : [res.headers.get('set-cookie')].filter(Boolean);
  if (raw.length) {
    const parts = raw.map((line) => line.split(';')[0]);
    const prev = new Map((jars.get(name) || '').split('; ').filter(Boolean).map((pair) => pair.split('=')));
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq > 0) prev.set(part.slice(0, eq), part.slice(eq + 1));
    }
    jars.set(name, [...prev].map(([key, value]) => `${key}=${value}`).join('; '));
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

try {
  await ready();

  const news = await api('a', 'GET', '/api/news');
  const marker = news.json?.data?.find((row) => row.title === 'suite-marker-7f3a');
  if (!marker) {
    throw new Error('сервер смотрит не в catalog_suite, записи остановлены: ' + JSON.stringify(news.json));
  }
  check('новость из отдельной базы', news.status === 200 && String(marker.content).includes('<img'), JSON.stringify(news.json));

  const emptyReviews = await api('a', 'GET', `/api/reviews?release_id=${pastId}`);
  check('чужие черновики не в ленте', emptyReviews.status === 200 && emptyReviews.json?.total === 0, JSON.stringify(emptyReviews.json));

  const profileEmpty = await api('a', 'GET', '/api/get-user-profile');
  check('профиль до визита пуст', profileEmpty.status === 200 && profileEmpty.json?.success === false, JSON.stringify(profileEmpty.json));

  const badEvent = await api('a', 'POST', '/api/events', { event_type: 'share', entity_type: 'album', entity_id: Number(pastId) });
  check('чужой тип сущности отвергнут', badEvent.status === 400, JSON.stringify(badEvent.json));

  const share = await api('a', 'POST', '/api/events', { event_type: 'share', entity_type: 'release', entity_id: Number(pastId) });
  check('шаринг релиза записан', share.status === 200 && share.json?.success === true, JSON.stringify(share.json));
  const shareRow = sql(`SELECT event_type, entity_type, entity_id FROM events WHERE event_type = 'share'`);
  check('в базе share/release', shareRow === `share\trelease\t${pastId}`, shareRow);

  const play = await api('a', 'POST', '/api/events', { event_type: 'play', entity_type: 'track', entity_id: Number(trackId) });
  check('прослушивание трека записано', play.status === 200, JSON.stringify(play.json));

  const booklet = await api('a', 'POST', '/api/feedback', {
    release_id: Number(pastId), name: 'Анна', review: 'Браво', email: '', want_booklet: true,
  });
  check('буклет без почты', booklet.status === 400, JSON.stringify(booklet.json));

  const injected = await api('a', 'POST', '/api/feedback', {
    release_id: Number(pastId), name: 'Анна', review: 'Браво', email: "a@b.c\nBcc: x@y.z", want_booklet: true,
  });
  check('почта с переводом строки', injected.status === 400, JSON.stringify(injected.json));

  const feedback = await api('a', 'POST', '/api/feedback', {
    release_id: Number(pastId), name: 'Анна', review: 'Браво', email: 'anna@example.com', want_booklet: false, subscribe: false,
  });
  check('отзыв принят', feedback.status === 200 && feedback.json?.success === true, JSON.stringify(feedback.json));
  const reviewRow = sql(`SELECT content, status FROM reviews WHERE release_id = ${pastId}`);
  check('отзыв ждёт модерации', reviewRow === 'Браво\tpending', reviewRow);

  const stillHidden = await api('b', 'GET', `/api/reviews?release_id=${pastId}`);
  check('непринятый отзыв скрыт', stillHidden.json?.total === 0, JSON.stringify(stillHidden.json));

  const own = await api('a', 'GET', `/api/feedback/?release_id=${pastId}`);
  check('автор видит свой отзыв', own.json?.review === 'Браво' && own.json?.status === 'pending', JSON.stringify(own.json));

  const profile = await api('a', 'GET', '/api/get-user-profile');
  check('профиль подставился', profile.json?.success === true && profile.json?.name === 'Анна' && profile.json?.email === 'anna@example.com', JSON.stringify(profile.json));

  const updated = await api('a', 'POST', '/api/feedback', {
    release_id: Number(pastId), name: 'Анна', review: 'Бис', email: 'anna@example.com',
  });
  check('повторный отзыв обновляет строку', updated.status === 200, JSON.stringify(updated.json));
  check('отзыв один', sql(`SELECT COUNT(*) FROM reviews`) === '1');
  check('текст заменён', sql(`SELECT content FROM reviews`) === 'Бис');

  sql(`UPDATE reviews SET status = 'approved' WHERE release_id = ${pastId}`);
  const published = await api('b', 'GET', `/api/reviews?release_id=${pastId}`);
  check('одобренный отзыв в ленте', published.json?.total === 1 && published.json?.data?.[0]?.content === 'Бис', JSON.stringify(published.json));

  const badOffset = await api('b', 'GET', `/api/reviews?release_id=${pastId}&limit=10&offset=-1`);
  check('отрицательный сдвиг не роняет ленту', badOffset.status === 200, `${badOffset.status} ${badOffset.text.slice(0, 180)}`);

  const remind = await api('a', 'POST', '/api/remind', {
    release_id: Number(futureId), name: 'Анна', email: 'anna@example.com', subscribe: true,
  });
  check('напоминание принято', remind.status === 200 && remind.json?.success === true, JSON.stringify(remind.json));
  check('очередь напоминаний', sql(`SELECT COUNT(*) FROM premiere_reminders WHERE release_id = ${futureId}`) === '1');

  const pastRemind = await api('c', 'POST', '/api/remind', {
    release_id: Number(pastId), name: 'Борис', email: 'boris@example.com', subscribe: false,
  });
  check('прошедшая премьера', pastRemind.status === 400, JSON.stringify(pastRemind.json));

  const clash = await api('c', 'POST', '/api/remind', {
    release_id: Number(tomorrowId), name: 'Борис', email: 'anna@example.com', subscribe: false,
  });
  check('чужая почта занята', clash.status === 409, JSON.stringify(clash.json));

  const reaction = await api('a', 'POST', '/api/reactions', {
    release_id: Number(pastId), track_id: Number(trackId), emotions: ['A', 'C', 'nope'],
  });
  check('эмоции записаны', reaction.status === 200, JSON.stringify(reaction.json));
  const flags = sql(`SELECT emotion_A, emotion_B, emotion_C FROM reactions WHERE track_id = ${trackId}`);
  check('только известные эмоции', flags === '1\t0\t1', flags);

  const cleared = await api('a', 'POST', '/api/reactions', {
    release_id: Number(pastId), track_id: Number(trackId), emotions: [],
  });
  check('снятие эмоций удаляет строку', cleared.status === 200 && sql('SELECT COUNT(*) FROM reactions') === '0', JSON.stringify(cleared.json));

  const badRate = await api('a', 'POST', '/api/rate-album', { release_id: Number(pastId), rating: 8 });
  check('оценка вне шкалы', badRate.status === 400, JSON.stringify(badRate.json));
  const rate = await api('a', 'POST', '/api/rate-album', { release_id: Number(pastId), rating: 7 });
  check('оценка семёрки', rate.status === 200 && sql(`SELECT rating FROM ratings WHERE release_id = ${pastId}`) === '7', JSON.stringify(rate.json));
  const rateEvent = sql(`SELECT event_type, entity_type FROM events WHERE event_type = 'rating'`);
  check('оценка пишет событие релиза', rateEvent === 'rating\trelease', rateEvent);

  const method = await api('a', 'GET', '/api/events');
  check('события только POST', method.status === 405, String(method.status));

  const statsDenied = await api('a', 'GET', '/api/admin/stats');
  check('админка без ключа', statsDenied.status === 401, JSON.stringify(statsDenied.json));
  await api('a', 'POST', '/api/reactions', {
    release_id: Number(pastId), track_id: Number(trackId), emotions: ['B'],
  });
  const stats = await fetch(`${base}/api/admin/stats`, { headers: { 'X-API-Key': '12345', Cookie: jars.get('a') || '' } });
  const statsText = await stats.text();
  let statsJson = null;
  try { statsJson = JSON.parse(statsText); } catch { statsJson = null; }
  check('статистика админки открывается', stats.status === 200 && statsJson?.overview, `${stats.status} ${statsText.slice(0, 240)}`);
  if (stats.status === 200) {
    const top = (statsJson.top_tracks || []).find((row) => String(row.id) === String(trackId));
  check('лайки считаются по реакциям', statsJson.overview.total_likes >= 1 && Number(top?.likes) >= 1, JSON.stringify(statsJson.overview) + ' ' + JSON.stringify(top));
  }

  const themeDir = path.join(root, 'source/css/themes');
  const needed = [
    '--theme-color-bg',
    '--theme-color-text-primary',
    '--theme-color-accent',
    '--theme-color-accent-secondary',
    '--theme-font-display',
  ];
  const { readFileSync } = await import('node:fs');
  const themes = readdirSync(themeDir).filter((name) => name.startsWith('theme-') && name.endsWith('.css'));
  const missingVars = [];
  for (const name of themes) {
    const css = readFileSync(path.join(themeDir, name), 'utf8');
    for (const variable of needed) {
      if (!css.includes(variable)) missingVars.push(`${name} ${variable}`);
    }
  }
  check('темы отдают цвета и шрифт', themes.length >= 9 && missingVars.length === 0, missingVars.join(', ') || `тем: ${themes.length}`);

  const cron = execFileSync('php', [
    path.join(mirror, 'cron/send-reminders.php'),
    '--dry-run',
  ], { encoding: 'utf8' });
  check('cron видит завтрашнюю премьеру', cron.includes('Завтрашний') && cron.includes('[dry-run]'), cron.trim());
  check('cron не берёт премьеру через три дня', !cron.includes('Будущий спектакль'), cron.trim());
  const sentBefore = sql(`SELECT IFNULL(SUM(sent_at IS NOT NULL), 0) FROM premiere_reminders`);
  execFileSync('php', [path.join(mirror, 'cron/send-reminders.php')], { encoding: 'utf8' });
  const sentAfter = sql(`SELECT IFNULL(SUM(sent_at IS NOT NULL), 0) FROM premiere_reminders`);
  check('пустой MAIL_FROM не помечает письма', sentBefore === sentAfter, `${sentBefore} -> ${sentAfter}`);

  let blocked = false;
  for (let i = 0; i < 40; i += 1) {
    const burst = await api('a', 'POST', '/api/events', {
      event_type: 'share', entity_type: 'track', entity_id: Number(trackId),
    });
    if (burst.status === 429) {
      blocked = true;
      break;
    }
  }
  check('лимит событий отвечает 429', blocked);
} finally {
  php.kill('SIGTERM');
  await sleep(200);
  const prodAfter = counts('catalog');
  const drifted = Object.keys(prodBefore).filter((table) => prodBefore[table] !== prodAfter[table]);
  check('рабочая база не изменилась', drifted.length === 0, drifted.map((table) => `${table} ${prodBefore[table]}->${prodAfter[table]}`).join(', '));
  try {
    execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite']);
  } catch (err) {
    console.log('drop', err.message);
  }
  rmSync(mirror, { recursive: true, force: true });
  const { unlinkSync } = await import('node:fs');
  for (const file of [
    ...extraFiles(path.join(root, 'source/storage/ratelimit'), rateBefore),
    ...extraFiles(path.join(root, 'source/storage/sessions'), sessionBefore),
  ]) {
    try { unlinkSync(file); } catch { /* уже удалён */ }
  }
}

if (failures.length) {
  console.log('ИТОГ FAIL', failures.length);
  for (const line of failures) console.log(' -', line);
  if (phpLog.trim()) console.log(phpLog.slice(-2000));
  process.exit(1);
}
console.log('ИТОГ OK');
