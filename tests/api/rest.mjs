// Оставшаяся админка на catalog_suite: жанры, пользователи, события,
// реакции, оценки, правка каталога, обложки и ручные таймкоды.
// Рабочая catalog только сверяется по числу строк.
//
//   node tests/api/rest.mjs

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = process.env.SUITE_PORT || '8095';
const base = `http://127.0.0.1:${port}`;
const mysql = ['-uroot', '-p12345', '--protocol=tcp', '-h127.0.0.1'];
const failures = [];
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const copyExt = new Set(['.php', '.css', '.js', '.mjs', '.html', '.woff', '.woff2']);

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

const prodBefore = counts('catalog');
const rateBefore = snapshotDir(path.join(root, 'source/storage/ratelimit'));
const sessionBefore = snapshotDir(path.join(root, 'source/storage/sessions'));

execFileSync('mysql', [...mysql, '-e', 'DROP DATABASE IF EXISTS catalog_suite; CREATE DATABASE catalog_suite CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;']);
execFileSync('mysql', [...mysql, 'catalog_suite'], {
  input: readFileSync(path.join(root, 'source/sql/catalog.sql')),
});
sql(`INSERT INTO news (title, content, is_published) VALUES ('suite-marker-rest', 'метка', 1)`);
sql(`INSERT INTO users (client_id, nickname, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Анна', 'anna-rest@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'Борис', 'boris-rest@example.com')`);

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

function upload(urlPath, bytes, name, type) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  return api('POST', urlPath, { form });
}

try {
  await ready();
  const news = await api('GET', '/api/news', { key: '' });
  const marker = news.json?.data?.find((row) => row.title === 'suite-marker-rest');
  if (!marker) throw new Error('сервер смотрит не в catalog_suite, записи остановлены');

  const stamps = await api('GET', '/api/admin/generate_timestamps?id=1');
  check('генерации таймкодов нет', stamps.status === 404 && !/whisper/i.test(stamps.text), `${stamps.status} ${stamps.text.slice(0, 120)}`);

  const genre = await api('POST', '/api/admin/genres', { json: { name: 'Камерный', slug: 'suite-genre' } });
  const genreId = genre.json?.id;
  check('жанр создан', genre.status === 201 && genreId, `${genre.status} ${genre.text.slice(0, 160)}`);
  const genreAgain = await api('POST', '/api/admin/genres', { json: { name: 'Другой', slug: 'suite-genre' } });
  check('повторный код жанра', genreAgain.status === 409, `${genreAgain.status} ${genreAgain.text.slice(0, 120)}`);
  const genrePut = await api('PUT', `/api/admin/genres?id=${genreId}`, { json: { name: 'Камерная сцена' } });
  const genreCard = await api('GET', `/api/admin/genres?id=${genreId}`);
  check('жанр переименован', genrePut.status === 200 && genreCard.json?.name === 'Камерная сцена', `${genrePut.status} ${genreCard.text.slice(0, 120)}`);
  const genrePage = await api('GET', '/api/admin/genres?offset=-1&search=' + encodeURIComponent('Камерная'));
  check('список жанров и отрицательный сдвиг', genrePage.status === 200 && genrePage.json?.data?.some((row) => row.slug === 'suite-genre'), `${genrePage.status} ${genrePage.text.slice(0, 120)}`);

  const release = await api('POST', '/api/admin/releases', {
    json: { title: 'Спектакль', slug: 'suite-show', theme: 'default', is_published: 1, release_year: 2026 },
  });
  const releaseId = release.json?.id;
  const releasePut = await api('PUT', `/api/admin/releases?id=${releaseId}`, { json: { title: 'Вечер <i>зал</i>', subtitle: 'подзаголовок' } });
  const releaseCard = await api('GET', `/api/admin/releases?id=${releaseId}`);
  check('релиз переименован', release.status === 201 && releasePut.status === 200 && releaseCard.json?.title === 'Вечер <i>зал</i>' && releaseCard.json?.subtitle === 'подзаголовок', `${release.status} ${releasePut.status} ${releaseCard.text.slice(0, 160)}`);

  const artist = await api('POST', '/api/admin/artists', { json: { name: 'Голос зала', slug: 'suite-voice', is_active: 1 } });
  const artistId = artist.json?.id;
  const artistPut = await api('PUT', `/api/admin/artists?id=${artistId}`, { json: { description: 'партия' } });
  const artistCard = await api('GET', `/api/admin/artists?id=${artistId}`);
  check('артист описан', artist.status === 201 && artistPut.status === 200 && artistCard.json?.description === 'партия', `${artist.status} ${artistCard.text.slice(0, 140)}`);

  const track = await api('POST', '/api/admin/tracks', {
    json: { title: 'Сцена первая', slug: 'suite-scene', lyrics: 'Первая строка\nВторая строка', is_published: 1, artist_ids: [artistId] },
  });
  const trackId = track.json?.id;
  const linked = await api('PUT', `/api/admin/releases?id=${releaseId}`, {
    json: { tracks: [{ track_id: trackId, track_number: 1 }], genre_ids: [genreId] },
  });
  check('трек и жанр вошли в релиз', track.status === 201 && linked.status === 200, `${track.status} ${linked.status} ${track.text.slice(0, 120)}`);

  const story = await api('POST', '/api/admin/news', { json: { title: 'Афиша недели', content: 'текст', is_published: 1 } });
  const storyId = story.json?.id;
  const storyPut = await api('PUT', `/api/admin/news?id=${storyId}`, { json: { title: 'Афиша месяца' } });
  const storyPage = await api('GET', '/api/admin/news?offset=-1&search=' + encodeURIComponent('месяца'));
  check('новость переименована', story.status === 201 && storyPut.status === 200 && storyPage.json?.data?.some((row) => row.title === 'Афиша месяца'), `${story.status} ${storyPut.status}`);

  const annaId = sql(`SELECT id FROM users WHERE email = 'anna-rest@example.com'`);
  const userLevel = await api('PUT', `/api/admin/users?id=${annaId}`, { json: { level: 9 } });
  const userPut = await api('PUT', `/api/admin/users?id=${annaId}`, { json: { nickname: 'Анна зал', level: 2 } });
  const userCard = await api('GET', `/api/admin/users?id=${annaId}`);
  const userPage = await api('GET', '/api/admin/users?offset=-1&search=' + encodeURIComponent('Анна'));
  check('уровень вне шкалы', userLevel.status === 422, `${userLevel.status} ${userLevel.text.slice(0, 120)}`);
  check('пользователь переименован', userPut.status === 200 && userCard.json?.nickname === 'Анна зал' && Number(userCard.json?.level) === 2 && userPage.status === 200, `${userPut.status} ${userCard.text.slice(0, 140)}`);
  const clash = await api('PUT', `/api/admin/users?id=${annaId}`, { json: { email: 'boris-rest@example.com' } });
  check('чужая почта пользователя занята', clash.status === 409, `${clash.status} ${clash.text.slice(0, 120)}`);

  sql(`INSERT INTO reviews (release_id, user_id, content, status) VALUES (${releaseId}, ${annaId}, 'Браво зал', 'pending')`);
  sql(`INSERT INTO events (user_id, event_type, entity_type, entity_id) VALUES
    (${annaId}, 'play', 'track', ${trackId}),
    (${annaId}, 'reaction_add', 'track', ${trackId})`);
  sql(`INSERT INTO ratings (release_id, user_id, rating) VALUES (${releaseId}, ${annaId}, 6)`);
  sql(`INSERT INTO reactions (release_id, track_id, user_id, emotion_A) VALUES (${releaseId}, ${trackId}, ${annaId}, 1)`);

  const userAfter = await api('GET', `/api/admin/users?id=${annaId}`);
  check('в карточке считаются реакции', Number(userAfter.json?.stats?.reactions) === 1 && Number(userAfter.json?.stats?.plays) === 1, JSON.stringify(userAfter.json?.stats));

  const eventPage = await api('GET', '/api/admin/events?offset=-1&event_type=reaction_add');
  const eventId = eventPage.json?.data?.find((row) => row.event_type === 'reaction_add')?.id;
  const eventCard = await api('GET', `/api/admin/events?id=${eventId}`);
  const wrongType = await api('GET', '/api/admin/events?event_type=reaction');
  const eventStats = await api('GET', '/api/admin/events/stats');
  check('список событий и отрицательный сдвиг', eventPage.status === 200 && eventId && eventCard.json?.entity_title === 'Сцена первая', `${eventPage.status} ${eventCard.text.slice(0, 140)}`);
  check('чужой тип события пуст', wrongType.status === 200 && wrongType.json?.total === 0, `${wrongType.status} ${wrongType.text.slice(0, 80)}`);
  check('сводка событий', eventStats.status === 200 && eventStats.json?.by_type?.some((row) => row.event_type === 'play'), `${eventStats.status} ${eventStats.text.slice(0, 160)}`);

  const reactionPage = await api('GET', '/api/admin/reactions?offset=-1&order=release_title&direction=ASC');
  const reactionOld = await api('GET', '/api/admin/reactions?order=album_title');
  const reactionId = reactionPage.json?.data?.find((row) => row.track_title === 'Сцена первая')?.id;
  check('список реакций сортируется по альбому', reactionPage.status === 200 && reactionId && reactionOld.status === 200, `${reactionPage.status} ${reactionOld.status} ${reactionPage.text.slice(0, 120)}`);

  const ratingPage = await api('GET', '/api/admin/ratings?offset=-1');
  const ratingId = ratingPage.json?.data?.find((row) => Number(row.rating) === 6)?.id;
  check('список оценок и отрицательный сдвиг', ratingPage.status === 200 && ratingId, `${ratingPage.status} ${ratingPage.text.slice(0, 120)}`);

  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1.4', '-c:a', 'libmp3lame', '-b:a', '64k', '/tmp/suite-tone.mp3'], { stdio: 'ignore' });
  const trackUuid = sql(`SELECT uuid FROM tracks WHERE id = ${trackId}`);
  const artistUuid = sql(`SELECT uuid FROM artists WHERE id = ${artistId}`);
  const releaseUuid = sql(`SELECT uuid FROM releases WHERE id = ${releaseId}`);
  const cover = await upload(`/api/admin/upload/track_cover?id=${trackId}`, png, 'cover.png', 'image/png');
  const audio = await upload(`/api/admin/upload/audio?id=${trackId}`, readFileSync('/tmp/suite-tone.mp3'), 'tone.mp3', 'audio/mpeg');
  const avatar = await upload(`/api/admin/upload/artist_avatar?id=${artistId}`, png, 'avatar.png', 'image/png');
  const poster = await upload(`/api/admin/upload/release_cover?id=${releaseId}`, png, 'poster.png', 'image/png');
  const coverFile = path.join(mirror, 'uploads/track', trackUuid, 'cover.jpg');
  const audioFile = path.join(mirror, 'uploads/track', trackUuid, 'audio.mp3');
  const avatarFile = path.join(mirror, 'uploads/artist', artistUuid, 'avatar.jpg');
  const posterFile = path.join(mirror, 'uploads/release', releaseUuid, 'cover.jpg');
  check('обложка трека сохранена', cover.status === 200 && cover.json?.url === `/uploads/track/${trackUuid}/cover.jpg` && existsSync(coverFile), `${cover.status} ${cover.text.slice(0, 140)}`);
  check('аудио трека на месте', audio.status === 200 && existsSync(audioFile), `${audio.status} ${audio.text.slice(0, 120)}`);
  check('аватар артиста сохранён', avatar.status === 200 && existsSync(avatarFile), `${avatar.status} ${avatar.text.slice(0, 140)}`);
  check('обложка релиза сохранена', poster.status === 200 && existsSync(posterFile), `${poster.status} ${poster.text.slice(0, 140)}`);

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
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/admin/login.html`, { waitUntil: 'domcontentloaded' });
    await page.type('#api-key', 'wrong');
    await page.click('#login-form button');
    await page.waitForFunction(() => document.getElementById('error')?.textContent.includes('Неверный ключ'));
    check('чужой ключ не пускает', true);
    await page.$eval('#api-key', (el) => { el.value = ''; });
    await page.type('#api-key', '12345');
    await page.click('#login-form button');
    await page.waitForFunction(() => document.body.innerText.includes('Всего прослушиваний'), { timeout: 8000 });
    check('сводка на входе', await page.evaluate(() => document.body.innerText.includes('Всего лайков')));

    const screens = [
      ['/admin/releases.html', 'Вечер'],
      ['/admin/tracks.html', 'Сцена первая'],
      ['/admin/artists.html', 'Голос зала'],
      ['/admin/news.html', 'Афиша месяца'],
      ['/admin/genres.html', 'Камерная сцена'],
      ['/admin/users.html', 'Анна зал'],
      ['/admin/reviews.html', 'Браво зал'],
      ['/admin/events.html', 'Сцена первая'],
      ['/admin/ratings.html', 'Вечер'],
      ['/admin/reactions.html', 'Сцена первая'],
      [`/admin/release-form.html?id=${releaseId}`, 'Вечер'],
      [`/admin/artist-form.html?id=${artistId}`, 'Голос зала'],
      [`/admin/news-form.html?id=${storyId}`, 'Афиша месяца'],
      [`/admin/genre-form.html?id=${genreId}`, 'Камерная сцена'],
      [`/admin/user-form.html?id=${annaId}`, 'Анна зал'],
    ];
    for (const [urlPath, text] of screens) {
      await page.goto(base + urlPath, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForFunction((needle) => {
          if (document.body.innerText.includes(needle)) return true;
          return [...document.querySelectorAll('input, textarea')].some((el) => (el.value || '').includes(needle));
        }, { timeout: 8000 }, text);
        const errored = await page.$('.toast-error');
        check(`экран ${urlPath.split('?')[0].replace('/admin/', '')}`, !errored);
      } catch (err) {
        check(`экран ${urlPath}`, false, String(err).slice(0, 160));
      }
    }

    await page.goto(`${base}/admin/releases.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.innerText.includes('Вечер'));
    const escaped = await page.$eval('#data-table', (el) => el.innerHTML);
    check('название релиза экранировано', escaped.includes('&lt;i&gt;') && !escaped.includes('<i>зал'));

    await page.goto(`${base}/admin/events.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#filter-event-type option[value="reaction_add"]'));
    await page.select('#filter-event-type', 'reaction_add');
    await page.click('#apply-filters-btn');
    await page.waitForFunction(() => document.body.innerText.includes('Реакция') && document.body.innerText.includes('Сцена первая'));
    check('фильтр реакций в списке событий', true);

    await page.goto(`${base}/admin/track-form.html?id=${trackId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('lyrics')?.value.includes('Первая строка') && document.getElementById('audio'), { timeout: 8000 });
    check('кнопки генерации нет', await page.$('#generate-timestamps-btn') === null);
    await page.click('#open-lrc-master');
    await page.waitForFunction(() => document.querySelectorAll('#lrc-lines .lrc-line').length === 2 && document.getElementById('lrc-master-modal').style.display === 'flex');
    await page.evaluate(async () => {
      const audio = document.getElementById('lrc-audio');
      await audio.play();
      audio.currentTime = 0.4;
    });
    await page.click('#lrc-record-btn');
    await page.evaluate(() => { document.getElementById('lrc-audio').currentTime = 0.9; });
    await page.click('#lrc-record-btn');
    await page.click('#lrc-save');
    const lrc = await page.$eval('#lyrics_timed', (el) => el.value);
    check('мастер записал таймкоды', lrc.includes('[00:00.40]') && lrc.includes('Первая строка') && lrc.includes('[00:00.90]') && lrc.includes('Вторая строка'), lrc);
    await page.click('#save-btn');
    await page.waitForFunction(() => document.body.innerText.includes('Трек сохранён'), { timeout: 8000 });
    const stored = sql(`SELECT lyrics_timed FROM tracks WHERE id = ${trackId}`);
    check('таймкоды лежат в треке', stored.includes('[00:00.40]') && stored.includes('Вторая строка'), stored.slice(0, 180));
  } finally {
    await browser.close();
  }

  const reviewId = sql(`SELECT id FROM reviews WHERE content = 'Браво зал'`);
  const removedReview = await api('DELETE', `/api/admin/reviews?id=${reviewId}`);
  const removedReaction = await api('DELETE', `/api/admin/reactions?id=${reactionId}`);
  const removedRating = await api('DELETE', `/api/admin/ratings?id=${ratingId}`);
  const removedEvent = await api('DELETE', `/api/admin/events?id=${eventId}`);
  check('отзыв, реакция, оценка и событие удалены', [removedReview, removedReaction, removedRating, removedEvent].every((res) => res.status === 200), [removedReview, removedReaction, removedRating, removedEvent].map((res) => res.status).join(','));

  const removedTrack = await api('DELETE', `/api/admin/tracks?id=${trackId}`);
  const removedArtist = await api('DELETE', `/api/admin/artists?id=${artistId}`);
  const removedRelease = await api('DELETE', `/api/admin/releases?id=${releaseId}`);
  check('файлы трека сняты', removedTrack.status === 200 && !existsSync(coverFile) && !existsSync(audioFile), String(removedTrack.status));
  check('файл артиста снят', removedArtist.status === 200 && !existsSync(avatarFile), String(removedArtist.status));
  check('файл релиза снят', removedRelease.status === 200 && !existsSync(posterFile), String(removedRelease.status));

  const removedNews = await api('DELETE', `/api/admin/news?id=${storyId}`);
  const removedGenre = await api('DELETE', `/api/admin/genres?id=${genreId}`);
  const removedUser = await api('DELETE', `/api/admin/users?id=${annaId}`);
  const genreGone = await api('GET', `/api/admin/genres?id=${genreId}`);
  check('новость, жанр и пользователь удалены', removedNews.status === 200 && removedGenre.status === 200 && removedUser.status === 200 && genreGone.status === 404, `${removedNews.status} ${removedGenre.status} ${removedUser.status} ${genreGone.status}`);
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
  if (phpLog.trim()) console.log(phpLog.slice(-2000));
  process.exit(1);
}
console.log('ИТОГ OK');
