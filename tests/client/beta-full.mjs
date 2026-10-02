// Прогон клиентских страниц и покрытие функций afisha.js, album.js,
// player.js и common.js. Ответы записи (отзыв, напоминание, оценка,
// эмоции, события) подменяются и в базу не попадают.
//
//   cd tests/client && npm ci && npm test
//
// BASE — адрес сайта, CHROME_PATH — исполняемый файл Chrome.
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const ARCHIVE_COVER = '/uploads/release/7d17d9c5-be37-11f1-96b5-822b383dbcd0/cover.jpg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const failures = [];
const pageErrors = [];
const posts = [];
function check(name, ok, detail = '') {
  if (ok) console.log('ok', name);
  else {
    const line = detail ? `${name}: ${detail}` : name;
    failures.push(line);
    console.log('FAIL', line);
  }
}

page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('dialog', async (dialog) => {
  pageErrors.push('dialog ' + dialog.message());
  await dialog.dismiss();
});

await page.evaluateOnNewDocument(() => {
  try {
    if (!sessionStorage.getItem('__suite')) {
      localStorage.clear();
      sessionStorage.setItem('__suite', '1');
    }
  } catch (e) {}
  const orig = HTMLMediaElement.prototype.play;
  let noiseRejects = 1;
  HTMLMediaElement.prototype.play = function (...args) {
    if (this.id === 'hall-noise' && noiseRejects > 0) {
      noiseRejects -= 1;
      return Promise.reject(new DOMException('NotAllowedError'));
    }
    return orig.apply(this, args);
  };
});

const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.startPreciseCoverage', { detailed: true, callCount: true });
const buckets = new Map();
let snapping = false;
async function snap() {
  if (snapping) return;
  snapping = true;
  try {
    const { result } = await cdp.send('Profiler.takePreciseCoverage');
    for (const script of result) {
      if (!script.url.includes('/js/')) continue;
      const name = script.url.split('/').pop().split('?')[0];
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push(script);
    }
  } catch (err) {
    console.log('snap', err.message);
  } finally {
    snapping = false;
  }
}

let holdCovers = false;
const heldCovers = [];
let failNews = false;
let abortStageFetch = false;
let apiMode = 'ok';
let plainErrorOnce = false;
const context = browser.defaultBrowserContext();
await context.overridePermissions(BASE, ['clipboard-read', 'clipboard-write']);

await page.setRequestInterception(true);
page.on('request', async (req) => {
  try {
    const url = req.url();
    if (url.includes('mc.yandex') || url.includes('metrika')) {
      await req.abort().catch(() => {});
      return;
    }
    if (failNews && url.includes('/api/news')) {
      failNews = false;
      await req.abort().catch(() => {});
      return;
    }
    if (abortStageFetch && req.resourceType() === 'fetch' && url.includes('track-1.html')) {
      abortStageFetch = false;
      await req.abort().catch(() => {});
      return;
    }
    if (holdCovers && url.includes('/uploads/') && url.includes('cover.jpg')) {
      heldCovers.push(req);
      return;
    }
    const api = url.match(/\/api\/([^?]*)/);
    if (api && /^(feedback\/?|remind|rate-album|reactions|events|reviews|get-user-profile)$/.test(api[1])) {
      if (plainErrorOnce && req.method() === 'POST') {
        plainErrorOnce = false;
        await req.respond({ status: 500, contentType: 'text/plain', body: 'nope' });
        return;
      }
      const path = api[1].replace(/\/$/, '');
      if (req.method() === 'POST') {
        let body = {};
        try { body = JSON.parse(req.postData() || '{}'); } catch { body = {}; }
        posts.push({ path, body });
      }
      if (req.method() === 'GET' && path === 'reviews') {
        await req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ content: 'Тихий зал', nickname: 'Зритель' }], total: 1 }),
        });
        return;
      }
      if (req.method() === 'GET' && path === 'feedback') {
        await req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ review: 'Уже писал из зала', status: 'pending' }),
        });
        return;
      }
      if (req.method() === 'GET' && path === 'get-user-profile') {
        await req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, name: 'Анна', email: 'anna@example.com' }),
        });
        return;
      }
      const ok = apiMode === 'ok';
      await req.respond({
        status: ok ? 200 : 500,
        contentType: 'application/json',
        body: JSON.stringify(ok ? { success: true } : { error: 'Сбой записи' }),
      });
      return;
    }
    if (req.resourceType() === 'document' && url.startsWith(BASE)) {
      const res = await fetch(url, { headers: { Accept: 'text/html' } });
      let html = await res.text();
      html = html.replaceAll('window.METRIKA_ID = 0', 'window.METRIKA_ID = 1');
      await req.respond({
        status: res.status,
        contentType: 'text/html; charset=utf-8',
        body: html,
      });
      return;
    }
    await req.continue();
  } catch (err) {
    console.log('request', err.message);
    try { await req.continue(); } catch { /* already handled */ }
  }
});

async function goto(url) {
  await snap();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
}

async function midAlpha() {
  return page.evaluate(() => {
    const c = document.getElementById('curtain-canvas');
    if (!c) return -1;
    const ctx = c.getContext('2d');
    const dpr = c.width / Math.max(c.clientWidth, 1);
    const px = ctx.getImageData(Math.floor((innerWidth / 2) * dpr), Math.floor((innerHeight / 2) * dpr), 1, 1).data;
    return px[3];
  });
}

async function openCurtain(timeout = 2500) {
  await page.evaluate(() => document.getElementById('curtain-canvas').click());
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await midAlpha() < 40) return true;
    await sleep(40);
  }
  return false;
}

await page.setViewport({ width: 1366, height: 768, hasTouch: true });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
holdCovers = true;
const afishaAt = Date.now();
await goto(BASE + '/');
holdCovers = false;
for (const req of heldCovers.splice(0)) {
  if (req.url().includes(ARCHIVE_COVER)) {
    await req.respond({ status: 404, contentType: 'text/plain', body: 'missing' });
  } else {
    await req.continue();
  }
}
await sleep(400);

const newsHtml = await page.$eval('#news-container', (el) => el.innerHTML);
check('новость на месте', newsHtml.includes('Анонс'));
check('новость экранирована', newsHtml.includes('&lt;img') && !newsHtml.includes('<img'));
check('заглушка архивной обложки', await page.$('#panel-archive .no-cover') !== null);

check('занавес открывается', await openCurtain());
await page.evaluate(() => {
  document.querySelectorAll('.smolder-text').forEach((el) => {
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  });
  window.dispatchEvent(new Event('touchend'));
  const curtain = document.getElementById('curtain-canvas');
  curtain.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
});
await sleep(500);
await page.evaluate(() => {
  document.querySelectorAll('.smolder-text').forEach((el) => {
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  });
  const btn = document.querySelector('.fire-btn');
  btn.scrollIntoView({ block: 'center' });
  btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
});
await sleep(400);
await page.evaluate(() => {
  document.querySelector('.fire-btn').dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
});
await sleep(1700);
await page.evaluate(() => {
  const goal = document.createElement('button');
  goal.type = 'button';
  goal.dataset.ymGoal = 'about_click';
  goal.setAttribute('data-ym-params', '{');
  document.body.appendChild(goal);
  goal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

await page.evaluate(() => {
  const panel = document.getElementById('panel-coming');
  const card = panel.querySelector('.poster-card');
  for (let i = 0; i < 3; i += 1) panel.appendChild(card.cloneNode(true));
});
await page.setViewport({ width: 390, height: 844, hasTouch: true });
await sleep(200);
let spreadInfo = await page.evaluate(() => ({
  portrait: matchMedia('(orientation: portrait)').matches,
  spreads: document.querySelectorAll('#panel-coming > .spread').length,
}));
if (spreadInfo.portrait && spreadInfo.spreads < 2) {
  await page.evaluate(() => {
    const mq = matchMedia('(orientation: portrait)');
    mq.dispatchEvent(new MediaQueryListEvent('change', { matches: mq.matches, media: mq.media }));
  });
  await sleep(100);
  spreadInfo = await page.evaluate(() => ({
    portrait: true,
    spreads: document.querySelectorAll('#panel-coming > .spread').length,
  }));
}
check('портрет собирает развороты', spreadInfo.spreads >= 4, JSON.stringify(spreadInfo));

await page.click('.program-tab[data-panel="coming"]');
const activeSpread = () => page.evaluate(() => {
  const spreads = [...document.querySelectorAll('#panel-coming > .spread')];
  return spreads.findIndex((s) => s.classList.contains('active'));
});
await page.click('.spread-next');
check('следующий разворот', await activeSpread() === 1);
await page.click('.spread-dot[data-index="3"]');
check('точка разворота', await activeSpread() === 3);
await page.click('.spread-prev');
check('предыдущий разворот', await activeSpread() === 2);
const view = await (await page.$('.program-viewport')).boundingBox();
await page.touchscreen.touchStart(view.x + view.width * 0.8, view.y + view.height * 0.4);
await page.touchscreen.touchMove(view.x + view.width * 0.15, view.y + view.height * 0.4);
await page.touchscreen.touchEnd();
await sleep(50);
check('свайп вперёд', await activeSpread() === 3);
await snap();

await page.click('.program-tab[data-panel="premiere"]');
await page.click('.poster-card.main-poster .media-video-toggle');
await page.waitForFunction(() => document.querySelector('.poster-card.main-poster .poster-media')?.classList.contains('video-active'), { timeout: 8000 });
await page.click('.program-tab[data-panel="coming"]');
await sleep(80);
check('смена вкладки останавливает ролик', await page.evaluate(() => !document.querySelector('.poster-media.video-active')));
await page.click('.program-tab[data-panel="premiere"]');
await page.click('.poster-card.main-poster .media-video-toggle');
await page.waitForFunction(() => document.querySelector('.poster-card.main-poster .poster-media')?.classList.contains('video-active'), { timeout: 8000 });
await page.click('.poster-card.main-poster .media-video-toggle');
await sleep(100);
check('видео возвращается к обложке', await page.evaluate(() => !document.querySelector('.poster-card.main-poster .poster-media').classList.contains('video-active')));
const visit = await page.$('.fire-btn');
await visit.hover();
await sleep(300);
await page.mouse.move(2, 2);
await sleep(1600);

await page.evaluate(() => {
  const orig = HTMLVideoElement.prototype.play;
  HTMLVideoElement.prototype.play = function (...args) {
    HTMLVideoElement.prototype.play = orig;
    return Promise.reject(new Error('video blocked'));
  };
});
await page.click('.program-tab[data-panel="archive"]');
await page.click('#panel-archive .media-video-toggle');
await sleep(200);
check('сбой видео не запирает кнопку', await page.evaluate(() => {
  const btn = document.querySelector('#panel-archive .media-video-toggle');
  return btn && !btn.disabled && !btn.classList.contains('loading');
}));

await page.evaluate(() => { location.hash = 'about'; });
await sleep(100);
check('якорь about', await page.$eval('.program-tab.active', (el) => el.dataset.panel) === 'about');
await page.evaluate(() => { location.hash = 'nope'; });
await sleep(80);
check('чужой якорь не сбрасывает вкладку', await page.$eval('.program-tab.active', (el) => el.dataset.panel) === 'about');
await page.focus('.program-tab[data-panel="coming"]');
await page.keyboard.press('Enter');
check('вкладка с клавиатуры', await page.$eval('.program-tab.active', (el) => el.dataset.panel) === 'coming');

const smolder = await (await page.$('.smolder-text')).boundingBox();
await page.mouse.move(smolder.x + 8, smolder.y + 8);
await sleep(350);
await page.mouse.move(2, 2);
await page.mouse.move(180, 160);
await page.mouse.move(420, 240);
await page.touchscreen.touchStart(30, 40);
await page.touchscreen.touchMove(80, 90);
await page.touchscreen.touchEnd();

await page.evaluate(() => {
  navigator.share = () => Promise.reject(new DOMException('AbortError'));
});
await page.click('#share-btn');
await page.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('Ссылка скопирована'), { timeout: 3000 }).catch(() => {});
check('тост шаринга', await page.evaluate(() => !!document.querySelector('.toast')?.textContent.includes('Ссылка скопирована')));
await page.click('.toast-close');
await sleep(250);

const remain = 8300 - (Date.now() - afishaAt);
if (remain > 0) await sleep(remain);
await sleep(2200);
await snap();

await page.setViewport({ width: 1280, height: 800, hasTouch: false });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await goto(BASE + '/');
check('пыль в проёме', await openCurtain(7000));
await sleep(2200);

await goto(BASE + '/about.html');
check('страница о студии', await page.title().then((t) => t.length > 0));

await goto(BASE + '/albums/client-future/');
await sleep(300);
await page.evaluate(() => document.body.click());
check('кнопка напоминания', await page.$eval('#action-button', (el) => el.textContent.includes('НАПОМНИТЬ')));
check('отзыв из зала', await page.waitForFunction(() => document.body.textContent.includes('Тихий зал'), { timeout: 4000 }).then(() => true).catch(() => false));
await page.click('#action-button');
await sleep(200);
check('окно напоминания', await page.$eval('#remind-modal', (el) => el.style.display === 'flex'));
await page.click('#remind-modal .modal-close');
check('крестик закрывает окно', await page.$eval('#remind-modal', (el) => el.style.display === 'none'));
await page.click('#action-button');
await sleep(100);
await page.evaluate(() => {
  document.getElementById('remind-modal').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
check('фон закрывает окно', await page.$eval('#remind-modal', (el) => el.style.display === 'none'));
await page.click('#action-button');
await sleep(100);
await page.keyboard.press('Escape');
check('escape закрывает окно', await page.$eval('#remind-modal', (el) => el.style.display === 'none'));

await page.click('#action-button');
await sleep(150);
await page.evaluate(() => {
  document.querySelectorAll('#remind-form [required]').forEach((el) => el.removeAttribute('required'));
  document.getElementById('remind-name').value = '';
  document.getElementById('remind-email').value = '';
});
await page.click('#remind-form button[type="submit"]');
await sleep(100);
check('напоминание без имени', await page.evaluate(() => !!document.querySelector('.toast-warning')?.textContent.includes('имя')));
await page.evaluate(() => { document.getElementById('remind-name').value = 'Анна'; });
await page.click('#remind-form button[type="submit"]');
await sleep(100);
check('напоминание без почты', await page.evaluate(() => document.body.textContent.includes('укажите ваш email')));
await page.evaluate(() => { document.getElementById('remind-email').value = 'anna@example.com'; });
apiMode = 'ok';
await page.click('#remind-form button[type="submit"]');
await sleep(250);
check('напоминание принято', await page.evaluate(() => document.body.textContent.includes('Напомним о премьере')));
check('окно закрылось после подписки', await page.$eval('#remind-modal', (el) => el.style.display === 'none'));
const remindPost = posts.filter((p) => p.path === 'remind').pop();
check('напоминание ушло без записи в базу', remindPost && remindPost.body.email === 'anna@example.com');

await page.click('#action-button');
await sleep(100);
apiMode = 'fail';
await page.evaluate(() => {
  document.querySelectorAll('#remind-form [required]').forEach((el) => el.removeAttribute('required'));
  document.getElementById('remind-name').value = 'Анна';
  document.getElementById('remind-email').value = 'anna@example.com';
  document.getElementById('remind-subscribe').checked = false;
});
await page.click('#remind-form button[type="submit"]');
await sleep(200);
check('сбой напоминания', await page.evaluate(() => !!document.querySelector('.toast-error')));
apiMode = 'ok';

await page.evaluate(() => {
  localStorage.setItem('emotions_2', '{');
  localStorage.setItem('applause_2', '4');
});

await goto(BASE + '/albums/client-past/');
await sleep(200);
await page.evaluate(() => document.body.click());
abortStageFetch = true;
await cdp.send('Debugger.enable');
const { breakpointId } = await cdp.send('Debugger.setBreakpointByUrl', {
  lineNumber: 180,
  urlRegex: 'album\\.js',
});
const paused = new Promise((resolve) => cdp.once('Debugger.paused', resolve));
const clickDone = page.click('#action-button');
const hit = await Promise.race([
  paused.then(() => true),
  sleep(8000).then(() => false),
]);
check('срыв подгрузки останавливается в обработчике', hit);
if (hit) {
  await snap();
  await cdp.send('Debugger.resume');
}
await cdp.send('Debugger.removeBreakpoint', { breakpointId }).catch(() => {});
await cdp.send('Debugger.disable').catch(() => {});
await clickDone;
await page.waitForFunction(() => location.pathname.endsWith('/track-1.html'), { timeout: 8000 });
check('срыв подгрузки ведёт на сцену', page.url().includes('track-1.html'));
await goto(BASE + '/albums/client-past/');
await page.click('#action-button');
await page.waitForFunction(() => location.pathname.endsWith('/track-1.html') && document.getElementById('player-A')?.dataset.handoff !== '1', { timeout: 8000 });
await snap();
check('вход в спектакль', await page.evaluate(() => {
  const audio = document.getElementById('player-A');
  return !!audio && audio.src.includes('audio.mp3');
}));

await page.setViewport({ width: 390, height: 844, hasTouch: true });
await sleep(200);
await page.evaluate(() => {
  const mq = matchMedia('(orientation: portrait)');
  mq.dispatchEvent(new MediaQueryListEvent('change', { matches: true, media: mq.media }));
  const bar = document.getElementById('progress-container');
  const rect = bar.getBoundingClientRect();
  bar.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
});
await sleep(100);
await page.waitForFunction(() => {
  const audio = document.getElementById('player-A');
  return audio && audio.seekable && audio.seekable.length > 0;
}, { timeout: 8000 });
const progress = await (await page.$('#progress-container')).boundingBox();
await page.mouse.click(progress.x + progress.width * 0.4, progress.y + progress.height * 0.5);
await sleep(400);
check('караоке в портрете', await page.evaluate(() => document.querySelectorAll('#lyrics-overlay-text .lyrics-overlay-line').length > 0));
await page.click('#play-pause-btn');
await sleep(100);
check('пауза', await page.evaluate(() => document.getElementById('player-A').paused));
await page.click('#play-pause-btn');
await page.click('#volume-control');
await page.evaluate(() => {
  const audio = document.getElementById('player-A');
  audio.dispatchEvent(new Event('waiting'));
  audio.dispatchEvent(new Event('playing'));
});
check('эмоции на сцене', await page.$$eval('.emotion-option', (els) => els.length === 7));
await page.click('.emotion-option');
await sleep(50);
check('эмоция выбирается', await page.$eval('.emotion-option', (el) => el.classList.contains('selected')));
await page.click('.emotion-option');
check('эмоция снимается', await page.$eval('.emotion-option', (el) => !el.classList.contains('selected')));
const reaction = posts.filter((p) => p.path === 'reactions').pop();
check('реакция не пишется в базу', !!reaction);

await page.evaluate(() => {
  const track = albumPlayer.tracks[albumPlayer.currentIndex];
  const broken = Object.assign({}, track, { cover: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>' });
  albumPlayer.updateUI(broken);
});
await sleep(200);
check('битая обложка не гасит эмоции', await page.$$eval('.emotion-option', (els) => els.length === 7));

await page.click('#share-btn');
await sleep(200);
const trackShare = posts.filter((p) => p.path === 'events' && p.body.event_type === 'share').pop();
check('шаринг сцены — событие трека', trackShare && trackShare.body.entity_type === 'track');

await sleep(2200);
await page.evaluate(() => {
  const audio = document.getElementById('player-A');
  if (audio.seekable.length) audio.currentTime = Math.max(0, audio.seekable.end(0) - 0.05);
});
await page.waitForFunction(() => location.pathname.endsWith('/track-2.html'), { timeout: 8000 });
check('конец сцены открывает следующую', page.url().includes('track-2.html'));
await page.setViewport({ width: 844, height: 390, hasTouch: true });
await sleep(300);
await page.evaluate(() => {
  const box = document.getElementById('lyrics-container');
  for (let i = 0; i < 40; i += 1) {
    const p = document.createElement('p');
    p.className = 'lyric-line';
    p.textContent = 'Строка ' + i;
    box.appendChild(p);
  }
  box.style.maxHeight = '80px';
  window.dispatchEvent(new Event('resize'));
});
await sleep(50);
check('кнопки прокрутки видны', await page.$eval('.scroll-buttons', (el) => el.classList.contains('visible') && getComputedStyle(el).display !== 'none'));
await page.evaluate(() => {
  const btn = document.querySelector('.scroll-down');
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
});
await sleep(180);
await page.evaluate(() => {
  document.querySelector('.scroll-down').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
const scrolled = await page.$eval('#lyrics-container', (el) => ({ top: el.scrollTop, h: el.clientHeight, sh: el.scrollHeight, down: !document.querySelector('.scroll-down').disabled }));
check('прокрутка текста', scrolled.top > 0, JSON.stringify(scrolled));
await page.evaluate(() => {
  const up = document.querySelector('.scroll-up');
  const downBtn = document.querySelector('.scroll-down');
  up.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  downBtn.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
  downBtn.dispatchEvent(new Event('touchend', { bubbles: true }));
  const box = document.getElementById('lyrics-container');
  box.scrollTop = box.scrollHeight;
  box.dispatchEvent(new Event('scroll'));
});
await page.click('#prev-btn');
await page.waitForFunction(() => location.pathname.endsWith('/track-1.html'), { timeout: 4000 });
await page.click('#next-btn');
await page.waitForFunction(() => location.pathname.endsWith('/track-2.html'), { timeout: 4000 });
await snap();
await page.click('#next-btn');
await page.waitForFunction(() => location.pathname.endsWith('/finale.html'), { timeout: 8000 });
check('после сцены занавес', await page.evaluate(() => document.body.textContent.includes('ЗАНАВЕС')));
check('с занавеса за буклетом', await page.$eval('a[href="after.html"]', (el) => el.classList.contains('album-btn-primary') && el.textContent.includes('Получить буклет')));
check('афиша тише буклета', await page.$eval('.finale-exit a[href="/"]', (el) => !el.classList.contains('album-btn') && getComputedStyle(el).opacity !== '1'));
await page.click('a[href="after.html"]');
await page.waitForFunction(() => location.pathname.endsWith('/after.html'), { timeout: 8000 });

check('бумага отзыва', await page.$eval('.feedback-section', (el) => getComputedStyle(el).backgroundColor === 'rgb(230, 213, 179)'));
check('чернила на бумаге', await page.$eval('[name="name"]', (el) => getComputedStyle(el).color === 'rgb(22, 53, 107)'));
check('логотип ниже края', await page.$eval('.afisha-logo i', (el) => el.getBoundingClientRect().top >= 8));
await page.waitForFunction(() => {
  const area = document.querySelector('[name="review"]');
  return area && area.value.includes('Уже писал');
}, { timeout: 4000 });
check('старый отзыв подставлен', true);
await page.waitForFunction(() => document.querySelector('[name="name"]').value === 'Анна', { timeout: 4000 });
check('профиль подставлен в отзыв', await page.$eval('[name="email"]', (el) => el.value === 'anna@example.com'));
check('кнопка правки', await page.$eval('#feedback-form button[type="submit"]', (el) => el.textContent.includes('Изменить')));

await page.evaluate(() => {
  document.querySelectorAll('#feedback-form [required]').forEach((el) => el.removeAttribute('required'));
  document.querySelector('[name="name"]').value = '';
  document.querySelector('[name="review"]').value = '';
  document.querySelector('[name="email"]').value = '';
  document.querySelector('[name="want_booklet"]').checked = true;
});
await page.click('#feedback-form button[type="submit"]');
await sleep(80);
check('отзыв без имени', await page.evaluate(() => document.body.textContent.includes('укажите ваше имя')));
await page.evaluate(() => { document.querySelector('[name="name"]').value = 'Анна'; });
await page.click('#want_booklet');
await page.click('#feedback-form button[type="submit"]');
await sleep(80);
check('отзыв без текста', await page.evaluate(() => document.body.textContent.includes('напишите отзыв')));
await page.click('#want_booklet');
await page.click('#feedback-form button[type="submit"]');
await sleep(80);
check('буклет просит почту', await page.evaluate(() => document.body.textContent.includes('укажите email')));
await page.evaluate(() => { document.querySelector('[name="email"]').value = 'anna@example.com'; });
apiMode = 'ok';
await page.click('#feedback-form button[type="submit"]');
await sleep(200);
check('буклет без отзыва', await page.evaluate(() => {
  const hint = document.querySelector('p.action-hint').textContent;
  return document.body.textContent.includes('Буклет отправим на почту') && hint.includes('в течение часа') && !hint.includes('модерации');
}));
await page.evaluate(() => { document.querySelector('[name="review"]').value = 'Браво'; });
await page.click('#feedback-form button[type="submit"]');
await sleep(200);
check('отзыв принят', await page.evaluate(() => document.body.textContent.includes('Буклет отправим на почту') && document.querySelector('p.action-hint').textContent.includes('модерации')));
const feedbackPost = posts.filter((p) => p.path === 'feedback').pop();
check('отзыв не записан в базу', feedbackPost && feedbackPost.body.review === 'Браво');
apiMode = 'fail';
await page.click('#feedback-form button[type="submit"]');
await sleep(200);
check('сбой отзыва', await page.evaluate(() => !!document.querySelector('.toast-error')));
apiMode = 'ok';
await sleep(5300);

const pastId = 2;
await page.evaluate((id) => {
  localStorage.setItem('applause_' + id, '4');
}, pastId);
await goto(BASE + '/albums/client-past/finale.html');
await sleep(200);
check('сохранённые аплодисменты', await page.$$eval('[data-rating].active', (els) => els.length >= 4));
check('таблица эмоций финала', await page.$$eval('.emotion-row', (els) => els.length >= 1));
apiMode = 'fail';
await page.click('[data-rating="5"]');
await sleep(200);
check('сбой оценки', await page.evaluate(() => !!document.querySelector('.toast-error')));
apiMode = 'ok';
await page.click('[data-rating="7"]');
await sleep(150);
check('бис подсвечивает шкалу', await page.$$eval('[data-rating].active', (els) => els.length >= 7));
const ratePost = posts.filter((p) => p.path === 'rate-album').pop();
check('оценка не записана в базу', ratePost && Number(ratePost.body.rating) === 7);
await page.click('#share-btn');
await sleep(200);
const albumShare = posts.filter((p) => p.path === 'events' && p.body.event_type === 'share').pop();
check('шаринг спектакля — событие релиза', albumShare && albumShare.body.entity_type === 'release');

plainErrorOnce = true;
const badApi = await page.evaluate(() => apiRequest('events', { event_type: 'share', entity_type: 'release', entity_id: 1 }));
check('битый ответ api', badApi && String(badApi.error).includes('невалидный JSON'));
const dropped = await page.evaluate(() => {
  const orig = window.fetch;
  window.fetch = () => Promise.reject(new Error('offline'));
  const pending = apiRequest('events', { event_type: 'share', entity_type: 'release', entity_id: 1 });
  window.fetch = orig;
  return pending;
});
check('обрыв сети', dropped && dropped.error === 'Ошибка сети');

failNews = true;
await goto(BASE + '/');
await sleep(200);
await goto(BASE + '/missing-page');
check('пустая сцена', await page.evaluate(() => document.body.textContent.includes('Страница не найдена')));

await snap();
await browser.close();

function report() {
  const files = ['afisha.js', 'album.js', 'player.js', 'common.js'];
  let total = 0;
  let used = 0;
  const missed = [];
  const rows = [];
  for (const name of files) {
    const scripts = buckets.get(name) || [];
    const fns = new Map();
    for (const script of scripts) {
      for (const fn of script.functions) {
        const ranges = fn.ranges;
        if (!ranges || !ranges.length) continue;
        const key = ranges[0].startOffset + ':' + ranges[0].endOffset;
        const prev = fns.get(key) || { name: fn.functionName || '(анонимная)', hit: false, len: ranges[0].endOffset - ranges[0].startOffset };
        if (ranges.some((r) => r.count > 0)) prev.hit = true;
        fns.set(key, prev);
      }
    }
    const list = [...fns.values()].filter((fn) => fn.len > 30);
    const hitN = list.filter((fn) => fn.hit).length;
    total += list.length;
    used += hitN;
    for (const fn of list) if (!fn.hit) missed.push(`${name} ${fn.name} (${fn.len})`);
    rows.push({ name, fn: list.length, hit: hitN, pct: list.length ? Math.round(1000 * hitN / list.length) / 10 : 0 });
  }
  const pct = total ? Math.round(1000 * used / total) / 10 : 0;
  return { pct, used, total, rows, missed };
}

const coverage = report();
console.log(JSON.stringify({ pct: coverage.pct, used: coverage.used, total: coverage.total, rows: coverage.rows }, null, 2));
console.log('не вызваны:\n' + (coverage.missed.join('\n') || '(пусто)'));
if (pageErrors.length) {
  console.log('исключения:\n' + pageErrors.slice(0, 20).join('\n'));
  failures.push('непойманные исключения: ' + pageErrors.length);
}
const unexpected = coverage.missed;
if (unexpected.length) failures.push('покрытие не полное: ' + unexpected.length);
if (failures.length) {
  console.log('ИТОГ FAIL', failures.length);
  for (const line of failures) console.log(' -', line);
  process.exit(1);
}
console.log('ИТОГ OK', coverage.pct + '%', coverage.used + '/' + coverage.total);
