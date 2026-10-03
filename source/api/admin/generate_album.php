<?php
// ============================================
// ГЕНЕРАТОР СТАТИЧЕСКИХ СТРАНИЦ АЛЬБОМА
// Вызывается из админки: /admin/generate_album?id=1
// ============================================

if (($resource ?? '') === 'generate_album') {
    if ($method !== 'GET') {
        jsonError('Метод не разрешен', 405);
    }

    if (!$id) {
        jsonError('Необходим ИД релиза', 400);
    }

    generate_afisha($id);
    generate_album($id);

    echo json_encode([
        'success' => true
    ]);
    exit;
}

function generate_footer($page='') {
    $about = '';
    if ($page !== 'about') {
        $about = '<a href="/#about" aria-label="О студии" data-ym-goal="about_click">О студии</a>';
    }
    $content = <<<HTML
<footer class="afisha-footer">
    <div class="afisha-footer-content">
        <p>© {{SITE_TITLE}}, {{CURRENT_YEAR}}. {{SLOGAN}}</p>
        <div class="afisha-social">
            {{TELEGRAM_URL}}{{STIHI_URL}}{{ABOUT}}<a href="#" id="share-btn" aria-label="Поделиться"><i class="fas fa-share-alt"></i></a>
        </div>
    </div>
    <p class="afisha-footer-note">
        Используем анонимную аналитику для улучшения театра. Продолжая, вы соглашаетесь.
    </p>
</footer>
HTML;
    return render_content($content, [
        'SITE_TITLE' => h(afisha_setting('site_title')), 
        'TELEGRAM_URL' => afisha_setting('telegram_url') !== '' ? '<a href="' . h(afisha_setting('telegram_url')) . '" aria-label="Telegram" data-ym-goal="telegram_click"><i class="fab fa-telegram"></i></a>' : '',
        'STIHI_URL' => afisha_setting('stihi_url') !== '' ? '<a href="' . h(afisha_setting('stihi_url')) . '" aria-label="Стихи" data-ym-goal="stihi_click"><i class="fas fa-book"></i></a>' : '',
        'CURRENT_YEAR' => date('Y'),
        'SLOGAN' => h(afisha_setting('slogan')),
        'ABOUT' => $about
    ]);
}

function generate_header() {
    $content = <<<HTML
<header class="afisha-header">
    <a href="/" class="afisha-logo">
        <i class="fas fa-masks-theater swing-on-hover"></i>
        <span class="smolder-text">{{SITE_TITLE}}</span>
    </a>
    <div class="afisha-divider"></div>
    <div class="afisha-tagline">
        <p class="smolder-text">{{SITE_TAGLINE}}</p>
    </div>
</header>
HTML;
    return render_content($content, [
        'SITE_TITLE' => h(afisha_setting('site_title')), 
        'SITE_TAGLINE' => h(afisha_setting('site_tagline'))
    ]);
}

function generate_meta($metaData) {
    $content = <<<HTML
<title>{{TITLE}}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%8E%AD</text></svg>">
<meta name="theme-color" content="{{THEME_COLOR}}">
<meta property="og:type" content="website">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="{{DESCRIPTION}}">
<meta property="og:image" content="{{IMAGE}}">
<meta property="og:url" content="{{URL}}">
HTML;
    $metaData['THEME_COLOR'] = $metaData['THEME_COLOR'] ?? '#0D0A0B';
    foreach (['TITLE', 'DESCRIPTION', 'IMAGE', 'URL', 'THEME_COLOR'] as $key) {
        $metaData[$key] = h($metaData[$key] ?? '');
    }
    return render_content($content, $metaData);
}

// ============================================
// ГЕНЕРАЦИЯ АФИШИ (главной страницы)
// ============================================
function generate_afisha($albumId) {
    $db = getDB();

    // 1. Настоящая премьера или текущий альбом
    $stmtPremiere = $db->prepare("
        SELECT r.*, 
               (SELECT COALESCE(SUM(t.duration), 0) 
                FROM release_tracks rt 
                JOIN tracks t ON rt.track_id = t.id 
                WHERE rt.release_id = r.id) AS duration_total
        FROM releases r
        WHERE r.is_published = 1 OR r.id = ?
        ORDER BY (r.is_published = 1 AND r.is_premiere = 1) DESC,
                 r.is_published DESC,
                 r.sort_order ASC,
                 r.id ASC
        LIMIT 1
    ");
    $stmtPremiere->execute([$albumId]);
    $premiere = $stmtPremiere->fetch(PDO::FETCH_ASSOC);

    if (!$premiere) {
        throw new Exception('Альбом не найден');
    }

    // 2. Ожидаемые релизы (is_premiere = 0, дата премьеры в будущем)
    $stmtComing = $db->prepare("
        SELECT id, slug, title, subtitle, uuid, type, premiere_date
        FROM releases
        WHERE is_published = 1 
          AND is_premiere = 0 
          AND id != ?
          AND (premiere_date IS NULL OR premiere_date >= CURDATE())
        ORDER BY premiere_date ASC
    ");
    $stmtComing->execute([$premiere['id']]);
    $comingSoon = $stmtComing->fetchAll(PDO::FETCH_ASSOC);

    // 2b. Архив (то же самое, но дата премьеры уже прошла)
    $stmtArchive = $db->prepare("
        SELECT id, slug, title, subtitle, uuid, type, premiere_date
        FROM releases
        WHERE is_published = 1 
          AND is_premiere = 0 
          AND id != ?
          AND premiere_date IS NOT NULL
          AND premiere_date < CURDATE()
        ORDER BY premiere_date DESC
    ");
    $stmtArchive->execute([$premiere['id']]);
    $archive = $stmtArchive->fetchAll(PDO::FETCH_ASSOC);

    // 3. Генерация HTML
    $theme = safe_theme($premiere['theme'] ?? 'default');
    $themeCss = '<link rel="stylesheet" href="/css/themes/theme-' . $theme . '.css">';

    // Секция премьеры
    $premiereHtml = '';
    if ($premiere) {
        $coverUrl = h(get_cover_url($premiere['uuid']));
        $albumUrl = '/albums/' . safe_slug($premiere['slug']) . '/';
        $durationFormatted = format_duration($premiere['duration_total']);
        $premiereTitle = h($premiere['title']);
        $premiereSubtitle = h($premiere['subtitle']);
        $premiereDescription = h($premiere['description']);
        $videoAttr = has_video($premiere['uuid']) 
            ? ' data-video="' . h(get_video_url($premiere['uuid'])) . '"' 
            : '';
        $videoBtn = has_video($premiere['uuid'])
            ? '<button type="button" class="media-video-toggle" aria-label="Смотреть видео"><i class="fas fa-play"></i></button>'
            : '';

        $premiereHtml = <<<HTML
<div class="poster-card main-poster"{$videoAttr}>
    <div class="poster-media">
        <img src="{$coverUrl}" alt="{$premiereTitle}">
        {$videoBtn}
        <div class="poster-overlay"></div>
        <div class="premiere-ribbon">ПРЕМЬЕРА</div>
    </div>
    <div class="poster-content">
        <h2 class="poster-title">{$premiereTitle}</h2>
        <p class="poster-subtitle">{$premiereSubtitle}</p>
        <p class="poster-description">{$premiereDescription}</p>
        <div class="poster-meta">
            <span><i class="fas fa-clock"></i> {$durationFormatted}</span>
            <span><i class="fas fa-users"></i> Труппа голосов</span>
        </div>
        <a href="{$albumUrl}" class="afisha-btn afisha-btn-large fire-btn" data-ym-goal="premiere_click">
            <i class="fas fa-ticket-alt"></i> ПОСЕТИТЬ
        </a>
    </div>
</div>
HTML;
    }

    // Карточка списка (используется и для «Скоро», и для «Архива»)
    $buildListCard = function($item, $dateLabel) {
        $coverUrl = h(get_cover_url($item['uuid']));
        $dateStr = h(format_date_ru($item['premiere_date']));
        $albumUrl = '/albums/' . safe_slug($item['slug']) . '/';
        $itemTitle = h($item['title']);
        $itemSubtitle = h($item['subtitle']);
        $ymParams = h(json_encode(['album' => $item['slug']], JSON_UNESCAPED_UNICODE));
        $videoAttr = has_video($item['uuid']) 
            ? ' data-video="' . h(get_video_url($item['uuid'])) . '"' 
            : '';
        $videoBtn = has_video($item['uuid'])
            ? '<button type="button" class="media-video-toggle" aria-label="Смотреть видео"><i class="fas fa-play"></i></button>'
            : '';
        return <<<HTML
<div class="poster-card coming"{$videoAttr}>
    <a href="{$albumUrl}" class="poster-card-link" data-ym-goal="coming_soon_click" data-ym-params="{$ymParams}">
        <div class="poster-media">
            <img src="{$coverUrl}" alt="{$itemTitle}">
        </div>
        <div class="poster-content">
            <h4 class="poster-title">{$itemTitle}</h4>
            <p class="poster-type">{$itemSubtitle}</p>
            <p class="poster-status">{$dateLabel}: {$dateStr}</p>
        </div>
    </a>
    {$videoBtn}
</div>
HTML;
    };

    $comingHtml = '';
    foreach ($comingSoon as $item) {
        $comingHtml .= $buildListCard($item, 'Премьера');
    }

    $archiveHtml = '';
    foreach ($archive as $item) {
        $archiveHtml .= $buildListCard($item, 'Премьера состоялась');
    }

    // ---------- ПРОГРАММКА: вкладки + панели ----------
    // Премьера и «О студии» показываются всегда, «Скоро»/«Архив» —
    // только если в них реально что-то есть (см. п. «пустые разделы
    // не показываем»).
    $aboutPanelHtml = <<<HTML
<div class="about-content">
    <i class="fas fa-quote-left"></i>
    <p>{ABOUT_TEXT}</p>
</div>
<h3 class="panel-subtitle"><i class="fas fa-bullhorn swing-on-hover"></i> Анонсы и вести</h3>
<div class="announce-list" id="news-container">
    <div class="announce-item">
        <span class="announce-date"></span>
        <span class="announce-text">Новостей пока нет</span>
        <i class="fas fa-quote-right"></i>
    </div>
</div>
HTML;
    $aboutPanelHtml = str_replace('{ABOUT_TEXT}', h(afisha_setting('about_text')), $aboutPanelHtml);

    $tabs = [];
    $tabs[] = ['id' => 'premiere', 'icon' => 'fa-star', 'label' => 'Премьера', 'short' => 'Премьера', 'body' => $premiereHtml, 'paged' => false];
    if ($comingHtml !== '') {
        $tabs[] = ['id' => 'coming', 'icon' => 'fa-hourglass-half', 'label' => 'Готовятся к постановке', 'short' => 'Скоро', 'body' => $comingHtml, 'paged' => true];
    }
    if ($archiveHtml !== '') {
        $tabs[] = ['id' => 'archive', 'icon' => 'fa-box-archive', 'label' => 'Архив', 'short' => 'Архив', 'body' => $archiveHtml, 'paged' => true];
    }
    $tabs[] = ['id' => 'about', 'icon' => 'fa-masks-theater', 'label' => 'О студии', 'short' => 'Студия', 'body' => $aboutPanelHtml, 'paged' => false];

    $navHtml = '';
    $panelsHtml = '';
    // Панель вкладок нужна только когда есть реальный выбор — при
    // минимальном наборе (Премьера + О студии, без анонсов/архива)
    // отдельная навигация не добавляет ценности, доступ к «О студии»
    // и так есть через футер.
    $showNav = count($tabs) > 2;
    foreach ($tabs as $i => $tab) {
        $activeClass = $i === 0 ? ' active' : '';
        if ($showNav) {
            $short = $tab['short'] ?? $tab['label'];
            $navHtml .= '<button type="button" class="program-tab' . $activeClass . '" data-panel="' . $tab['id'] . '"><i class="fas ' . $tab['icon'] . '"></i><span class="tab-long">' . $tab['label'] . '</span><span class="tab-short">' . $short . '</span></button>';
        }
        $pagedAttr = $tab['paged'] ? ' data-paged="1"' : '';
        $panelsHtml .= '<section class="program-panel' . $activeClass . '" id="panel-' . $tab['id'] . '"' . $pagedAttr . '>' . $tab['body'] . '</section>';
    }

    $metaData = [
        'TITLE' => afisha_setting('site_title'),
        'DESCRIPTION' => afisha_setting('site_tagline'),
        'IMAGE' => BASE_URL . '/media/preview.jpg',
        'URL' => BASE_URL,
        'THEME_COLOR' => get_theme_bg_color($theme)
    ];    
    
    // Рендер полного шаблона
    $html = render_template('afisha.html.tpl', [
        'META' => generate_meta($metaData),
        'HEADER' => generate_header(),
        'FOOTER' => generate_footer(),
        'THEME_CSS' => $themeCss,
        
        'ALBUM_ID' => (int) $premiere['id'],
        'ALBUM_SLUG_JS' => json_for_script($premiere['slug']),
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),
        
        'PROGRAM_NAV' => $navHtml,
        'PROGRAM_PANELS' => $panelsHtml
    ]);

    file_put_contents(ROOT_DIR . '/index.html', $html);

    // Старый адрес «О студии» вёл на манифест. Текст студии живёт на вкладке афиши.
    file_put_contents(ROOT_DIR . '/about.html', "<!DOCTYPE html>\n<html lang=\"ru\"><head><meta charset=\"UTF-8\"><title>О студии</title><meta http-equiv=\"refresh\" content=\"0; url=/#about\"><link rel=\"canonical\" href=\"/#about\"></head><body><p><a href=\"/#about\">О студии</a></p></body></html>\n");

    // Генерация страницы «404»
    $html = render_template('404.html.tpl', [
        'META' => generate_meta($metaData),
        'THEME_CSS' => $themeCss,
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),
    ]);
    file_put_contents(ROOT_DIR . '/404.html', $html);
}

function generate_album($albumId) {
    $data = load_album_data($albumId);
    $slug = (string) $data['album']['slug'];
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $slug)) {
        throw new Exception('Некорректный код альбома');
    }
    $outputDir = ALBUMS_DIR . '/' . $slug;

    if (!is_dir($outputDir)) {
        mkdir($outputDir, 0755, true);
    }

    generate_index($outputDir, $data);
    generate_troupe($outputDir, $data);
    generate_finale($outputDir, $data);
    generate_after($outputDir, $data);

    foreach ($data['tracks'] as $index => $track) {
        generate_track($outputDir, $data, $track, $index);
    }

    generate_afisha($albumId);
}

function load_album_data($albumId) {
    $db = getDB();

    $stmt = $db->prepare("SELECT * FROM releases WHERE id = ?");
    $stmt->execute([$albumId]);
    $album = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$album)
        throw new Exception('Альбом не найден');

    $stmtT = $db->prepare("
        SELECT t.*, rt.track_number
        FROM release_tracks rt
        JOIN tracks t ON rt.track_id = t.id
        WHERE rt.release_id = ?
        ORDER BY rt.track_number
    ");
    $stmtT->execute([$albumId]);
    $tracks = $stmtT->fetchAll(PDO::FETCH_ASSOC);

    $durationTotal = 0;
    foreach ($tracks as &$track) {
        $durationTotal += (int) ($track['duration'] ?? 0);
        $stmtA = $db->prepare("
            SELECT a.name FROM track_artists ta
            JOIN artists a ON ta.artist_id = a.id
            WHERE ta.track_id = ?
        ");
        $stmtA->execute([$track['id']]);
        $track['artists'] = $stmtA->fetchAll(PDO::FETCH_COLUMN);

        $stmtG = $db->prepare("
            SELECT g.name FROM track_genre tg
            JOIN genres g ON tg.genre_id = g.id
            WHERE tg.track_id = ?
        ");
        $stmtG->execute([$track['id']]);
        $track['genres'] = $stmtG->fetchAll(PDO::FETCH_COLUMN);
    }
    $album['duration_total'] = $durationTotal;

    return [
        'album' => $album,
        'tracks' => $tracks
    ];
}

// ============================================
// ФУНКЦИИ ГЕНЕРАЦИИ ОТДЕЛЬНЫХ ФАЙЛОВ
// ============================================
function album_troupe_members(int $albumId): array {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT DISTINCT a.name, a.voice_type, a.description, a.uuid, a.sort_order
        FROM artists a
        JOIN track_artists ta ON ta.artist_id = a.id
        JOIN release_tracks rt ON rt.track_id = ta.track_id
        WHERE rt.release_id = ? AND a.is_active = 1
        ORDER BY a.sort_order ASC, a.name ASC
    ");
    $stmt->execute([$albumId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function render_troupe_grid(array $members): string {
    $html = '';
    foreach ($members as $member) {
        $avatarHtml = has_avatar($member['uuid'])
            ? '<img src="' . h(get_avatar_url($member['uuid'])) . '" alt="' . h($member['name']) . '" loading="lazy">'
            : '<i class="fas fa-theater-masks swing-on-hover"></i>';
        $voiceTypeHtml = $member['voice_type']
            ? '<p class="troupe-member-voice">' . h($member['voice_type']) . '</p>'
            : '';
        $descriptionHtml = $member['description']
            ? '<p class="troupe-member-bio">' . h($member['description']) . '</p>'
            : '';
        $memberName = h($member['name']);
        $monogram = h(mb_substr($member['name'], 0, 1));
        $html .= <<<HTML
<div class="troupe-member">
    <div class="troupe-member-avatar">{$avatarHtml}<span class="troupe-monogram" aria-hidden="true">{$monogram}</span></div>
    <h3>{$memberName}</h3>
    {$voiceTypeHtml}
    {$descriptionHtml}
</div>
HTML;
    }
    return $html !== '' ? $html : '<p class="text-muted">Состав труппы скоро будет объявлен</p>';
}

function generate_troupe($outputDir, $data) {
    $album = $data['album'];
    $baseUrl = BASE_URL . '/albums/' . $album['slug'];
    $authorBioHtml = afisha_setting('author_bio') !== ''
        ? '<p>' . h(afisha_setting('author_bio')) . '</p>'
        : '';
    $metaData = [
        'TITLE' => 'Труппа · ' . $album['title'] . ' · ' . afisha_setting('site_title'),
        'DESCRIPTION' => afisha_setting('author_bio'),
        'IMAGE' => get_cover_url($album['uuid']),
        'URL' => $baseUrl . '/troupe.html',
        'THEME_COLOR' => get_theme_bg_color($album['theme'] ?? 'default')
    ];
    $html = render_template('about.html.tpl', [
        'META' => generate_meta($metaData),
        'HEADER' => generate_header(),
        'FOOTER' => generate_footer(),
        'THEME_CSS' => getThemeCss($album),
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),
        'TROUPE_GRID' => render_troupe_grid(album_troupe_members((int) $album['id'])),
        'AUTHOR_NAME' => h(afisha_setting('default_author')),
        'AUTHOR_BIO' => $authorBioHtml,
        'BACK_HREF' => 'index.html',
        'BACK_LABEL' => 'Вернуться к программке'
    ]);
    file_put_contents($outputDir . '/troupe.html', $html);
}

function generate_index($outputDir, $data) {
    $album = $data['album'];
    $baseUrl = BASE_URL . '/albums/' . $album['slug'];

    $metaData = [
        'TITLE' => $album['title'] . ' · ' . afisha_setting('site_title'),
        'DESCRIPTION' => $album['description'],
        'IMAGE' => get_cover_url($album['uuid']),
        'URL' => $baseUrl . '/',
        'THEME_COLOR' => get_theme_bg_color($album['theme'] ?? 'default')
    ];

    $tracklistHtml = '';
    foreach ($data['tracks'] as $index => $track) {
        $num = $index + 1;
        $track_type = $track['is_instrumental'] ? 'Инструментал' : 'Вокал';
        $tracklistHtml .= '<li><span class="track-num">' . $num . '.</span><span class="track-title">' . h($track['title']) . '</span><span class="track-type">' . h($track_type) . '</span><span class="track-duration">' . h(format_duration($track['duration'])) . '</span></li>';
    }

    $albumVideoAttr = has_video($album['uuid']) 
        ? ' data-video="' . h(get_video_url($album['uuid'])) . '"' 
        : '';
    $albumVideoBtn = has_video($album['uuid'])
        ? '<button type="button" class="media-video-toggle" aria-label="Смотреть видео"><i class="fas fa-play"></i></button>'
        : '';

    $html = render_template('index.html.tpl', [
        'META' => generate_meta($metaData),
        'HEADER' => generate_header(),
        'FOOTER' => generate_footer(),
        'THEME_CSS' => getThemeCss($album),
        
        'ALBUM_ID' => (int) $album['id'],
        'ALBUM_SLUG_JS' => json_for_script($album['slug']),
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),
        'EMOTION_MAP_JSON' => json_for_script(getEmotionMapSimple()),
        
        'ALBUM_COVER' => h(get_cover_url($album['uuid'])),
        'ALBUM_VIDEO_ATTR' => $albumVideoAttr,
        'ALBUM_VIDEO_BTN' => $albumVideoBtn,
        'ALBUM_TITLE' => h($album['title']),
        'ALBUM_SUBTITLE' => h($album['subtitle']),
        'TRACKLIST' => $tracklistHtml,
        'DURATION_TOTAL' => h(format_duration($album['duration_total'])),
        'ALBUM_DESCRIPTION' => h($album['description']),
        'FIRST_TRACK_AUDIO' => h(!empty($data['tracks'][0]['uuid']) ? get_audio_url($data['tracks'][0]['uuid']) : ''),
        
        'PREMIERE_DATE_JS' => json_for_script($album['premiere_date'])
    ]);

    file_put_contents($outputDir . '/index.html', $html);
}

function generate_track($outputDir, $data, $track, $index) {
    $album = $data['album'];
    $baseUrl = BASE_URL . '/albums/' . $album['slug'];

    $trackNum = $index + 1;

    $trackVideoAttr = has_video($track['uuid'], 'track') 
        ? ' data-video="' . h(get_video_url($track['uuid'], 'track')) . '"' 
        : '';
    $trackVideoBtn = has_video($track['uuid'], 'track')
        ? '<button type="button" class="media-video-toggle" aria-label="Смотреть видео"><i class="fas fa-play"></i></button>'
        : '';

    $metaData = [
        'TITLE' => $track['title'] . ' · ' . $album['title'],
        'DESCRIPTION' => implode(', ', $track['artists']) . ' · ' . $album['title'],
        'IMAGE' => get_cover_url($track['uuid'], 'track'),
        'URL' => $baseUrl . '/track-' . $trackNum . '.html',
        'THEME_COLOR' => get_theme_bg_color($album['theme'] ?? 'default')
    ];

    $html = render_template('track.html.tpl', [
        'META' => generate_meta($metaData),
        'THEME_CSS' => getThemeCss($album),
        
        'ALBUM_ID' => (int) $album['id'],
        'ALBUM_SLUG_JS' => json_for_script($album['slug']),
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),

        //для интерфейса
        'TRACK_NUM' => (int) $trackNum,  
        'ALBUM_TITLE' => h($album['title']),
        'TRACK_TITLE' => h($track['title']),
        'VOCAL_TYPE' => h($track['is_instrumental'] ? 'Инструментал' : 'Вокал'),
        'TRACK_DURATION' => h(format_duration($track['duration'])),
        'TRACK_COVER' => h(get_cover_url($track['uuid'], 'track')),
        'TRACK_VIDEO_ATTR' => $trackVideoAttr,
        'TRACK_VIDEO_BTN' => $trackVideoBtn,
        'AUTHORS' => h($track['authors']),
        'ARTISTS' => h(implode(', ', $track['artists'])),
        'PREV_DISABLED' => ($index > 0 ? '' : 'disabled'),
        
        //для share-btn
        'TRACK_ID' => (int) $track['id'],
        'TRACK_SLUG_JS' => json_for_script($track['slug']),
        
        'CURRENT_TRACK_INDEX' => (int) $index,
        'EMOTION_MAP_JSON' => json_for_script(getEmotionMapSimple()),
        'ALBUM_TRACKS_JSON' => json_for_script(array_map(function($t) {
            return [
                'id' => (int) $t['id'],
                'title' => $t['title'],
                'slug' => $t['slug'],
                'audio' => get_audio_url($t['uuid']),
                'cover' => get_cover_url($t['uuid'], 'track'),
                'video' => has_video($t['uuid'], 'track') ? get_video_url($t['uuid'], 'track') : '',
                'lyrics_timed' => parseLrc($t['lyrics_timed'] ?? ''),
                'lyrics' => $t['lyrics'] ?? '',
                'suggested_emotions' => $t['suggested_emotions'] ?? '',
                'duration' => (int)($t['duration'] ?? 0),
                'is_instrumental' => (bool)(int)($t['is_instrumental'] ?? 0),
                'artists' => implode(', ', $t['artists']),
                'authors' => $t['authors']
            ];
        }, $data['tracks'])),        
    ]);

    file_put_contents($outputDir . "/track-{$trackNum}.html", $html);
}

function generate_finale($outputDir, $data) {
    $album = $data['album'];
    $baseUrl = BASE_URL . '/albums/' . $album['slug'];

    $metaData = [
        'TITLE' => 'Занавес · ' . $album['title'],
        'DESCRIPTION' => 'Представление окончено. Аплодисменты альбому.',
        'IMAGE' => get_cover_url($album['uuid']),
        'URL' => $baseUrl . '/finale.html',
        'THEME_COLOR' => get_theme_bg_color($album['theme'] ?? 'default')
    ];

    $tracksJson = json_for_script(array_map(fn($t) => ['id' => (int) $t['id'], 'title' => $t['title']], $data['tracks']));

    $html = render_template('finale.html.tpl', [
        'META' => generate_meta($metaData),
        'HEADER' => generate_header(),
        'FOOTER' => generate_footer(),
        'THEME_CSS' => getThemeCss($album),
        
        'ALBUM_ID' => (int) $album['id'],
        'ALBUM_SLUG_JS' => json_for_script($album['slug']),
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),
        'TRACKS_JSON' => $tracksJson,
        'EMOTION_MAP_JSON' => json_for_script(getEmotionMapSimple()),
        
        'ALBUM_TITLE' => h($album['title'])
    ]);

    file_put_contents($outputDir . '/finale.html', $html);
}

function generate_after($outputDir, $data) {
    $album = $data['album'];
    $baseUrl = BASE_URL . '/albums/' . $album['slug'];

    $metaData = [
        'TITLE' => 'После спектакля · ' . $album['title'],
        'DESCRIPTION' => 'Получите буклет спектакля',
        'IMAGE' => get_cover_url($album['uuid']),
        'URL' => $baseUrl . '/after.html',
        'THEME_COLOR' => get_theme_bg_color($album['theme'] ?? 'default')
    ];

    $html = render_template('after.html.tpl', [
        'META' => generate_meta($metaData),
        'HEADER' => generate_header(),
        'FOOTER' => generate_footer(),
        'THEME_CSS' => getThemeCss($album),
        
        'ALBUM_ID' => (int) $album['id'],
        'ALBUM_SLUG_JS' => json_for_script($album['slug']),
        'METRIKA_ID' => (int) afisha_setting('metrika_id'),

        'ALBUM_TITLE' => h($album['title'])
    ]);

    file_put_contents($outputDir . '/after.html', $html);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function safe_theme($theme): string {
    $theme = (string) ($theme ?: 'default');
    if (!preg_match('/^[a-z0-9-]{1,40}$/', $theme)) {
        return 'default';
    }
    return is_file(ROOT_DIR . '/css/themes/theme-' . $theme . '.css') ? $theme : 'default';
}

function safe_slug($slug): string {
    $slug = (string) $slug;
    return preg_match('/^[a-zA-Z0-9_-]+$/', $slug) ? $slug : rawurlencode($slug);
}

function json_for_script($value): string {
    $json = json_encode(
        $value,
        JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
    );
    return $json === false ? 'null' : $json;
}

function getThemeCss($album) {
    $theme = safe_theme($album['theme'] ?? 'default');
    return '<link rel="stylesheet" href="/css/themes/theme-' . $theme . '.css">';
}

function render_content($content, $vars) {
    foreach ($vars as $key => $value) {
        $content = str_replace('{{' . $key . '}}', $value, $content);
    }
    return $content;
}

function render_template($templateName, $vars) {
    $templatePath = TEMPLATES_DIR . '/' . $templateName;
    if (!file_exists($templatePath)) {
        throw new Exception("Шаблон не найден: $templatePath");
    }
    $content = file_get_contents($templatePath);
    foreach ($vars as $key => $value) {
        $content = str_replace('{{' . $key . '}}', $value, $content);
    }
    return $content;
}

function format_duration($seconds) {
    $mins = floor($seconds / 60);
    $secs = $seconds % 60;
    return sprintf("%d:%02d", $mins, $secs);
}

function format_date_ru($dateStr) {
    $raw = (string) ($dateStr ?? '');
    $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    // Пустая дата у соседнего спектакля не должна ронять всю афишу.
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        return 'дата не назначена';
    }
    $timestamp = strtotime($raw);
    if (!$timestamp) {
        return 'дата не назначена';
    }
    return date('j', $timestamp) . ' ' . $months[date('n', $timestamp) - 1] . ' ' . date('Y', $timestamp);
}

function getEmotionMapSimple(): array {
    return array_map(function($info) {
        return ['emoji' => $info['emoji'], 'name' => $info['name']];
    }, EMOTION_MAP);
}

function parseLrc(string $lrc): array {
    $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $lrc));
    $result = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;
        if (preg_match('/^\[(\d+):(\d+\.\d+)\](.*)/', $line, $m)) {
            $time = (int)$m[1] * 60 + (float)$m[2];
            $text = trim($m[3]);
            $result[] = ['time' => $time, 'text' => $text];
        }
    }
    return $result;
}
