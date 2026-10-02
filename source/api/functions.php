<?php
//functions.php
   
// Подключение к БД
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            jsonError('Ошибка подключения к базе', 500);
        }
    }
    return $pdo;
}

// JSON-ответ
function jsonResponse($result, int $code = 200): void {
    //error_log("$code=" . $code);
    //error_log("release=" . var_export($data, true));
    //error_log(json_encode($data, JSON_UNESCAPED_UNICODE));

    http_response_code($code);
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

// JSON-ошибка
function jsonError(string $message, int $code): void {
    #error_log("error=" . $message);
    jsonResponse(['error' => $message], $code);
}

// JSON-ошибка с детализацией полей
function jsonErrorExtend(array $errors, array $warnings, int $code = 422): void {
    jsonResponse(['error' => 'Ошибка валидации', 'errors' => $errors, 'warnings' => $warnings], $code);
}

// Проверка API-ключа админа
function checkAdminAuth(): void {
    $headers = getallheaders();
    $apiKey = $headers['X-API-Key'] ?? '';
    if ($apiKey !== ADMIN_API_KEY) {
        jsonError('Не авторизовано', 401);
    }
}

function isUuidV4(string $value): bool {
    return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value);
}

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// Личность посетителя живёт в серверной сессии. Cookie HttpOnly,
// идентификатор выдаёт сервер. Заголовок X-Client-Id больше не
// принимается: его можно было подставить и читать чужой профиль.
function ensureVisitorSession(): string {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        $dir = ROOT_DIR . '/storage/sessions';
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        $lifetime = 60 * 60 * 24 * 365;
        ini_set('session.gc_maxlifetime', (string) $lifetime);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_save_path($dir);
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
        session_name('studio_visitor');
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => $secure,
        ]);
        session_start();
    }

    $current = $_SESSION['client_id'] ?? '';
    if (is_string($current) && isUuidV4($current)) {
        return $current;
    }

    session_regenerate_id(true);
    $id = generateUuidV4();
    $_SESSION['client_id'] = $id;
    return $id;
}

function getClientId(): ?string {
    return ensureVisitorSession();
}

function h($value): string {
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function isSafeEmail(string $email): bool {
    if ($email === '' || preg_match('/[\r\n\0]/', $email)) {
        return false;
    }
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function clientIp(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!is_string($ip) || !filter_var($ip, FILTER_VALIDATE_IP)) {
        return '0.0.0.0';
    }
    return $ip;
}

// Ограничение публичных записей: отдельно на сессию и на адрес.
// Файлы счётчиков лежат вне отдачи вебом (см. .htaccess, storage/).
function enforcePublicRate(string $bucket, int $perClient, int $perIp, int $windowSec): void {
    $client = getClientId() ?: 'none';
    $allowed = rateAllows($bucket . '|c|' . $client, $perClient, $windowSec)
        && rateAllows($bucket . '|ip|' . clientIp(), $perIp, $windowSec);
    if (!$allowed) {
        jsonError('Слишком много запросов. Попробуйте позже.', 429);
    }
}

function rateAllows(string $key, int $limit, int $windowSec): bool {
    $dir = ROOT_DIR . '/storage/ratelimit';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    $path = $dir . '/' . hash('sha256', $key) . '.json';
    $fh = fopen($path, 'c+');
    if ($fh === false) {
        return true;
    }
    try {
        if (!flock($fh, LOCK_EX)) {
            return true;
        }
        $raw = stream_get_contents($fh);
        $data = json_decode($raw ?: '', true);
        $now = time();
        if (!is_array($data) || !isset($data['start'], $data['hits']) || ($data['start'] + $windowSec) <= $now) {
            $data = ['start' => $now, 'hits' => 0];
        }
        if ($data['hits'] >= $limit) {
            return false;
        }
        $data['hits']++;
        rewind($fh);
        ftruncate($fh, 0);
        fwrite($fh, json_encode($data));
        fflush($fh);
        return true;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

// Получение тела запроса как массива
function getRequestBody(): array {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

// Генерация slug
function generateSlug(string $text): string {
    $ruMap = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'yo', 'ж' => 'zh', 'з' => 'z',
        'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r',
        'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'shch',
        'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu', 'я' => 'ya'
    ];
    $text = mb_strtolower(trim($text), 'UTF-8');
    $text = strtr($text, $ruMap);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');
    return $text ?: 'untitled';
}

// Оптимизация изображения (GD)
function optimizeImage(string $sourcePath, string $targetPath, int $maxSize = 1200): bool {
    if (!file_exists($sourcePath))
        return false;
    $imageInfo = getimagesize($sourcePath);
    if (!$imageInfo)
        return false;

    $mime = $imageInfo['mime'];
    $width = $imageInfo[0];
    $height = $imageInfo[1];
    $newWidth = $width;
    $newHeight = $height;

    if ($width > $maxSize || $height > $maxSize) {
        if ($width > $height) {
            $newWidth = $maxSize;
            $newHeight = (int) ($height * ($maxSize / $width));
        } else {
            $newHeight = $maxSize;
            $newWidth = (int) ($width * ($maxSize / $height));
        }
    }

    switch ($mime) {
        case 'image/jpeg': $srcImage = imagecreatefromjpeg($sourcePath);
            break;
        case 'image/png': $srcImage = imagecreatefrompng($sourcePath);
            break;
        case 'image/webp': $srcImage = imagecreatefromwebp($sourcePath);
            break;
        case 'image/gif': $srcImage = imagecreatefromgif($sourcePath);
            break;
        default: return false;
    }
    if (!$srcImage)
        return false;

    $dstImage = imagecreatetruecolor($newWidth, $newHeight);
    if ($mime == 'image/png' || $mime == 'image/gif') {
        imagealphablending($dstImage, false);
        imagesavealpha($dstImage, true);
        $transparent = imagecolorallocatealpha($dstImage, 0, 0, 0, 127);
        imagefilledrectangle($dstImage, 0, 0, $newWidth, $newHeight, $transparent);
    }
    imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

    $result = imagejpeg($dstImage, $targetPath, 85);
    imagedestroy($srcImage);
    imagedestroy($dstImage);
    return $result;
}

// Определение длительности MP3 через getID3
function getAudioDuration(string $filePath): int {
    if (file_exists(GETID3_PATH)) {
        require_once GETID3_PATH;
    } else {
        return 0;
    }
    
    if (!file_exists($filePath) || !class_exists('getID3'))
        return 0;
    try {
        $getID3 = new getID3();
        $fileInfo = $getID3->analyze($filePath);
        return isset($fileInfo['playtime_seconds']) ? (int) round($fileInfo['playtime_seconds']) : 0;
    } catch (Exception $e) {
        return 0;
    }
}

function getOrCreateUser(PDO $pdo, string $clientId, array $data = []): int {
    // Ищем пользователя по client_id
    $stmt = $pdo->prepare("SELECT id FROM users WHERE client_id = ?");
    $stmt->execute([$clientId]);
    $userId = $stmt->fetchColumn();

    if ($userId) {
        $userId = (int) $userId;
        // Обновляем данные, если они переданы
        $updates = [];
        $params = [];
        
        if (!empty($data['nickname'])) {
            $updates[] = 'nickname = ?';
            $params[] = $data['nickname'];
        }
        if (array_key_exists('email', $data)) {
            $email = trim((string) $data['email']);
            $updates[] = 'email = ?';
            $params[] = $email === '' ? null : $email;
        }
        if (isset($data['subscribe'])) {
            $updates[] = 'is_subscribed = ?';
            $params[] = (int)(bool)$data['subscribe'];
        }
        
        if (!empty($updates)) {
            $params[] = $userId;
            $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?");
            $stmt->execute($params);
        }
        
        return $userId;
    }

    // Создаём нового пользователя
    $email = trim((string) ($data['email'] ?? ''));
    $stmtCreate = $pdo->prepare("INSERT INTO users (client_id, nickname, email, is_subscribed) VALUES (?, ?, ?, ?)");
    $stmtCreate->execute([
        $clientId,
        $data['nickname'] ?? 'Гость',
        $email === '' ? null : $email,
        (int)(bool)($data['subscribe'] ?? 0)
    ]);
    
    return (int) $pdo->lastInsertId();
}

// ============================================
// Функции формирования URL по UUID
// ============================================
function get_cover_url($uuid, $type = 'release') {
    return '/uploads/' . $type . '/' . $uuid . '/cover.jpg';
}

function get_video_url($uuid, $type = 'release') {
    return '/uploads/' . $type . '/' . $uuid . '/video.mp4';
}

// Проверка на диске (а не в браузере) — используется при статической
// генерации, чтобы не добавлять в разметку кнопку переключения на
// видео, если файла на самом деле нет.
function has_video($uuid, $type = 'release') {
    return file_exists(UPLOAD_DIR . $type . '/' . $uuid . '/video.mp4');
}

function get_audio_url($uuid) {
    return '/uploads/track/' . $uuid . '/audio.mp3';
}

// Цвет фона темы для <meta name="theme-color"> — красит системный UI
// мобильного браузера (адресную строку/статус-бар) под тему релиза,
// а не оставляет его дефолтным белым на фоне тёмного дизайна сайта.
// Тот же приём чтения из живого CSS, что и в generateBooklet() —
// единственный источник правды остаётся в css/themes/theme-*.css.
function get_theme_bg_color($theme) {
    $theme = (string) $theme;
    if (!preg_match('/^[a-z0-9-]{1,40}$/', $theme)) {
        $theme = 'default';
    }
    $path = ROOT_DIR . '/css/themes/theme-' . $theme . '.css';
    if (file_exists($path)) {
        $css = file_get_contents($path);
        if (preg_match('/--theme-color-bg\s*:\s*([^;]+);/', $css, $m)) {
            return trim($m[1]);
        }
    }
    return '#0D0A0B'; // фолбэк — фон темы default
}

function get_avatar_url($uuid) {
    return '/uploads/artist/' . $uuid . '/avatar.jpg';
}

// Проверка на диске — не показываем в разметке фото артиста, если
// файл на самом деле не загружен (аналогично has_video()).
function has_avatar($uuid) {
    return file_exists(UPLOAD_DIR . 'artist/' . $uuid . '/avatar.jpg');
}

function generateBooklet($albumId, $data, $user = null) {
    if (!file_exists(TCPDF_PATH)) {
        return;
    }
    if (!defined('TCPDF_SILENCE_DEPRECATION')) {
        define('TCPDF_SILENCE_DEPRECATION', true);
    }
    require_once TCPDF_PATH;
    
    $album = $data['album'];
    $tracks = $data['tracks'];
    
    // 1. Извлекаем цвета и шрифт заголовков напрямую из CSS-файла темы —
    // без отдельного PHP-конфига (единственный источник правды — CSS).
    $theme = $album['theme'] ?? 'default';
    $themeCssPath = ROOT_DIR . '/css/themes/theme-' . $theme . '.css';
    $colors = [
        'bg'        => '#0B0709',
        'text'      => '#F5EDE0',
        'gold'      => '#C9A96E',
        'accent'    => '#A52235',
        'muted'     => '#9E845C'
    ];
    // Шрифт заголовков зависит от темы (Cormorant/Playfair/Russo One),
    // текст и UI-подписи — одинаковые во всех темах (Cormorant/Montserrat),
    // поэтому не нуждаются в извлечении. 'cover' — тот же шрифт, но самое
    // тяжёлое доступное начертание (для титульной страницы, один раз).
    $fonts = [
        'display' => 'playfairdisplayb',
        'cover'   => 'playfairdisplayblack',
        'body'    => 'cormorantgaramond',
        'ui'      => 'montserrat',
        'ui_bold' => 'montserratsemib',
        'accent'  => 'marckscript',
    ];
    // Перевод CSS font-family → реально сконвертированные имена шрифтов
    // в TCPDF (см. api/vendor/TCPDF/fonts/ — каждое начертание добавлено
    // TCPDF_FONTS::addTTFfont() как отдельное имя, а не style-вариант).
    $displayFontMap = [
        'Playfair Display'    => ['display' => 'playfairdisplayb', 'cover' => 'playfairdisplayblack'],
        'Cormorant Garamond'  => ['display' => 'cormorantgaramondsemib', 'cover' => 'cormorantgaramondsemib'],
        'Russo One'           => ['display' => 'russoone', 'cover' => 'russoone'],
    ];
    if (file_exists($themeCssPath)) {
        $css = file_get_contents($themeCssPath);
        preg_match('/--theme-color-bg\s*:\s*([^;]+);/', $css, $mBg);
        preg_match('/--theme-color-text-primary\s*:\s*([^;]+);/', $css, $mText);
        preg_match('/--theme-color-accent-secondary-light\s*:\s*([^;]+);/', $css, $mGoldLight);
        preg_match('/--theme-color-accent\s*:\s*([^;]+);/', $css, $mAccent);
        preg_match('/--theme-color-accent-secondary\s*:\s*([^;]+);/', $css, $mGold);
        if ($mBg) $colors['bg'] = trim($mBg[1]);
        if ($mText) $colors['text'] = trim($mText[1]);
        if ($mGoldLight) $colors['gold'] = trim($mGoldLight[1]);
        elseif ($mGold) $colors['gold'] = trim($mGold[1]);
        if ($mAccent) $colors['accent'] = trim($mAccent[1]);
        if ($mGold) $colors['muted'] = trim($mGold[1]);

        preg_match('/--theme-font-display\s*:\s*\'([^\']+)\'/', $css, $mFont);
        if ($mFont && isset($displayFontMap[$mFont[1]])) {
            $fonts['display'] = $displayFontMap[$mFont[1]]['display'];
            $fonts['cover'] = $displayFontMap[$mFont[1]]['cover'];
        }
    }

    // 2. Настройка PDF
    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8');
    $pdf->SetCreator(SITE_TITLE);
    $pdf->SetAuthor(DEFAULT_AUTHOR);
    $pdf->SetTitle($album['title'] . ' — Буклет');
    $pdf->SetMargins(15, 15, 15);
    $pdf->SetAutoPageBreak(true, 20);
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    
    // Функция для конвертации HEX → RGB
    $hex2rgb = function($hex) {
        $hex = ltrim($hex, '#');
        return array_map('hexdec', str_split($hex, 2));
    };
    $bgRgb = $hex2rgb($colors['bg']);
    $textRgb = $hex2rgb($colors['text']);
    $goldRgb = $hex2rgb($colors['gold']);
    $accentRgb = $hex2rgb($colors['accent']);
    $mutedRgb = $hex2rgb($colors['muted']);

    // Фон страниц
    $addBg = function() use ($pdf, $bgRgb) {
        $pdf->Rect(0, 0, 210, 297, 'F', [], $bgRgb);
    };

    // --- ТИТУЛЬНАЯ СТРАНИЦА ---
    $pdf->AddPage();
    $addBg();
    $pdf->SetTextColor(...$goldRgb);
    $pdf->SetFont($fonts['ui'], '', 12);
    $pdf->Cell(0, 8, SITE_TITLE, 0, 1, 'C');
    $pdf->Ln(4);
    
    // --- ПЕРСОНАЛИЗАЦИЯ (если известен пользователь) ---
    if ($user && !empty($user['nickname'])) {
        // Тёплое обращение
        $pdf->SetFont($fonts['body'], '', 16);
        $pdf->SetTextColor(...$textRgb);
        $pdf->Cell(0, 10, 'Этот буклет создан для', 0, 1, 'C');

        // Имя рукописным шрифтом
        $pdf->SetFont($fonts['accent'], '', 22);
        $pdf->SetTextColor(...$goldRgb);
        $pdf->Cell(0, 14, $user['nickname'], 0, 1, 'C');        
        
        $pdf->SetFont($fonts['ui'], '', 10);
        $pdf->SetTextColor(...$mutedRgb);
        $pdf->Cell(0, 6, date('d.m.Y'), 0, 1, 'C');
        $pdf->Ln(6);
    }    
    
    $pdf->SetFont($fonts['cover'], '', 28);
    $pdf->MultiCell(0, 12, $album['title'], 0, 'C');
    
    if (!empty($album['subtitle'])) {
        $pdf->SetFont($fonts['body'], '', 14);
        $pdf->SetTextColor(...$textRgb);
        $pdf->MultiCell(0, 8, $album['subtitle'], 0, 'C');
    }
    
    $coverPath = UPLOAD_DIR . 'release/' . $album['uuid'] . '/cover.jpg';
    if (file_exists($coverPath)) {
        $pdf->Ln(6);
        $pdf->Image($coverPath, 30, $pdf->GetY(), 150, 150, '', '', '', true, 300);
    }

    // --- ОПИСАНИЕ ---
    $pdf->AddPage();
    $addBg();
    if (!empty($album['description'])) {
        $pdf->SetFont($fonts['display'], '', 16);
        $pdf->SetTextColor(...$goldRgb);
        $pdf->Cell(0, 8, 'О спектакле', 0, 1);
        $pdf->Ln(3);
        $pdf->SetFont($fonts['body'], '', 11);
        $pdf->SetTextColor(...$textRgb);
        $pdf->MultiCell(0, 6, $album['description'], 0, 'L');
        $pdf->Ln(6);
    }

    // Труппа
    $allArtists = [];
    foreach ($tracks as $t) {
        foreach ($t['artists'] as $a) $allArtists[$a] = true;
    }
    if (!empty($allArtists)) {
        $pdf->SetFont($fonts['display'], '', 14);
        $pdf->SetTextColor(...$goldRgb);
        $pdf->Cell(0, 8, 'Труппа', 0, 1);
        $pdf->Ln(2);
        $pdf->SetFont($fonts['body'], '', 11);
        $pdf->SetTextColor(...$textRgb);
        foreach (array_keys($allArtists) as $name) {
            $pdf->Cell(0, 6, '• ' . $name, 0, 1);
        }
    }

    // --- ТРЕКИ ---
    foreach ($tracks as $i => $track) {
        $pdf->AddPage();
        $addBg();
        $trackCoverPath = UPLOAD_DIR . 'track/' . $track['uuid'] . '/cover.jpg';
        $leftMargin = 15;
        if (file_exists($trackCoverPath)) {
            $pdf->Image($trackCoverPath, 15, 30, 60, 60, '', '', '', true, 300);
            $leftMargin = 60;
        }
        $pdf->SetXY($leftMargin, 30);
        $pdf->SetFont($fonts['display'], '', 18);
        $pdf->SetTextColor(...$goldRgb);
        $pdf->MultiCell(140, 8, ($i + 1) . '. ' . $track['title'], 0, 'C');
        
        $pdf->SetXY($leftMargin, $pdf->GetY() + 2);
        $pdf->SetFont($fonts['body'], '', 10);
        $pdf->SetTextColor(...$mutedRgb);
        $meta = [];
        if ($track['artists']) $meta[] = implode(', ', $track['artists']);
        if ($meta) $pdf->Cell(140, 5, implode(' — ', $meta), 0, 1, 'C');
        
        $pdf->SetXY($leftMargin, $pdf->GetY() + 6);
        $pdf->SetFont($fonts['body'], '', 11);
        $pdf->SetTextColor(...$textRgb);
        $lyrics = $track['lyrics'] ?: '[Инструментальная композиция]';
        $pdf->MultiCell(140, 5.5, $lyrics, 0, 'C');
    }

    // --- ЗАВЕРШЕНИЕ ---
    $pdf->AddPage();
    $addBg();
    $pdf->SetFont($fonts['display'], '', 16);
    $pdf->SetTextColor(...$goldRgb);
    $pdf->Cell(0, 8, 'Спасибо!', 0, 1, 'C');
    $pdf->Ln(8);
    $pdf->SetFont($fonts['body'], '', 11);
    $pdf->SetTextColor(...$textRgb);
    $pdf->MultiCell(0, 6, SITE_TITLE . ' благодарит вас за внимание.' . "\n\n" . SLOGAN . "\n\n" . 'Следите за новыми постановками на нашем сайте.', 0, 'C');

    // --- QR-КОД НА АЛЬБОМ ---
    $albumUrl = BASE_URL . '/albums/' . $album['slug'] . '/';
    // Модули тёмные на белом. Светлый код на фоне темы сканер не читает.
    $style = [
        'border' => false,
        'vpadding' => 2,
        'hpadding' => 2,
        'fgcolor' => [0, 0, 0],
        'bgcolor' => [255, 255, 255],
        'module_width' => 1,
        'module_height' => 1
    ];
    $pdf->Ln(10);
    $pdf->SetFont($fonts['ui'], '', 8);
    $pdf->SetTextColor(...$mutedRgb);
    $pdf->Cell(0, 5, 'QR-код альбома', 0, 1, 'C');
    $pdf->Ln(3);
    
    // QR-код
    $pdf->write2DBarcode($albumUrl, 'QRCODE,H', 85, $pdf->GetY(), 40, 40, $style, 'N');
    $pdf->SetY($pdf->GetY() + 5);    
    
    // Текстовая ссылка (кликабельная)
    $pdf->SetFont($fonts['ui'], '', 8);
    $pdf->SetTextColor(...$goldRgb);
    $pdf->Cell(0, 5, 'или перейдите по ссылке:', 0, 1, 'C');
    $pdf->SetFont($fonts['ui_bold'], '', 9);
    $pdf->Cell(0, 6, $albumUrl, 0, 1, 'C', 0, $albumUrl);    
    
    // --- ПОДПИСЬ АВТОРА ---
    $pdf->Ln(20);
    $pdf->SetFont($fonts['accent'], '', 18);
    $pdf->SetTextColor(...$goldRgb);
    $pdf->Cell(0, 10, DEFAULT_AUTHOR, 0, 1, 'R');
    $pdf->SetFont($fonts['ui'], '', 8);
    $pdf->SetTextColor(...$mutedRgb);
    $pdf->Cell(0, 5, 'автор стихов и либретто', 0, 1, 'R');    
    
    $outputPath = ALBUMS_DIR . '/' . $album['slug'] . '/booklet.pdf';
    if (!is_dir(dirname($outputPath))) mkdir(dirname($outputPath), 0755, true);
    $pdf->Output($outputPath, 'F');
}
