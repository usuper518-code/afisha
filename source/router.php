<?php
// Роутер встроенного сервера PHP. Apache его не вызывает: там те же
// запреты записаны в .htaccess, а php -S этот файл не читает.
//   php -d upload_max_filesize=64M -d post_max_size=64M -S 0.0.0.0:8080 -t source source/router.php
// Статику отдаём сами: встроенный сервер не умеет Range, и браузер
// тогда не даёт перематывать уже скачанное аудио и видео.
// /api и /api/* всегда идут в api/index.php. Соседние .php не исполняются.
// storage, logs, sql, cron, templates и vendor по HTTP закрыты.

$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');
$uri = str_replace('\\', '/', $uri);
if (str_contains($uri, "\0")) {
    betaDeny(400, 'Bad request');
    return true;
}
$uri = preg_replace('#/+#', '/', $uri) ?? '/';
if ($uri === '' || $uri[0] !== '/') {
    $uri = '/' . ltrim($uri, '/');
}
if (preg_match('#(^|/)\.\.(/|$)#', $uri) === 1) {
    betaDeny(400, 'Bad request');
    return true;
}

$blocked = ['/storage', '/logs', '/sql', '/cron', '/templates', '/api/vendor'];
foreach ($blocked as $prefix) {
    if ($uri === $prefix || str_starts_with($uri, $prefix . '/')) {
        betaDeny(403, 'Forbidden');
        return true;
    }
}

$leaf = basename($uri);
if ($leaf !== '' && $leaf[0] === '.') {
    betaDeny(403, 'Forbidden');
    return true;
}

if ($uri === '/api' || str_starts_with($uri, '/api/')) {
    require __DIR__ . '/api/index.php';
    return true;
}

$ext = strtolower(pathinfo($uri, PATHINFO_EXTENSION));
if (in_array($ext, ['php', 'phtml', 'phar', 'phps', 'sql', 'log', 'tpl', 'ini'], true)) {
    betaDeny(403, 'Forbidden');
    return true;
}

$file = __DIR__ . $uri;

if ($uri !== '/' && is_file($file)) {
    if (betaServeFile($file)) {
        return true;
    }
}

// /admin/ и другие каталоги — как DirectoryIndex на Apache.
$dir = rtrim($file, '/');
if ($uri !== '/' && is_dir($dir)) {
    $index = $dir . '/index.html';
    if (is_file($index) && betaServeFile($index)) {
        return true;
    }
    betaDeny(403, 'Forbidden');
    return true;
}

if ($uri === '/' && is_file(__DIR__ . '/index.html')) {
    if (betaServeFile(__DIR__ . '/index.html')) {
        return true;
    }
    return false;
}

http_response_code(404);
if (is_file(__DIR__ . '/404.html')) {
    readfile(__DIR__ . '/404.html');
    return true;
}

echo 'Not found';
return true;

function betaDeny(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
}

function betaContentType(string $path): string
{
    $map = [
        'html' => 'text/html; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'mjs' => 'text/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'mp3' => 'audio/mpeg',
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'txt' => 'text/plain; charset=utf-8',
        'pdf' => 'application/pdf',
    ];
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (isset($map[$ext])) {
        return $map[$ext];
    }
    $detected = mime_content_type($path);
    return is_string($detected) && $detected !== '' ? $detected : 'application/octet-stream';
}

function betaServeFile(string $path): bool
{
    $root = realpath(__DIR__);
    $real = realpath($path);
    if ($root === false || $real === false || !is_file($real)) {
        return false;
    }
    if ($real !== $root && !str_starts_with($real, $root . DIRECTORY_SEPARATOR)) {
        return false;
    }

    $size = filesize($real);
    if ($size === false) {
        return false;
    }

    header('Accept-Ranges: bytes');
    header('Content-Type: ' . betaContentType($real));

    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $range = $_SERVER['HTTP_RANGE'] ?? '';
    $start = 0;
    $end = $size - 1;
    $partial = false;

    if ($range !== '' && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m) === 1) {
        $hasStart = $m[1] !== '';
        $hasEnd = $m[2] !== '';
        if (!$hasStart && !$hasEnd) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            return true;
        }
        if (!$hasStart) {
            $suffix = (int) $m[2];
            if ($suffix <= 0) {
                http_response_code(416);
                header('Content-Range: bytes */' . $size);
                return true;
            }
            $start = max(0, $size - $suffix);
        } else {
            $start = (int) $m[1];
            if ($hasEnd) {
                $end = (int) $m[2];
            }
        }
        if ($size === 0 || $start >= $size || $start > $end) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            return true;
        }
        if ($end >= $size) {
            $end = $size - 1;
        }
        $partial = true;
    }

    $length = $end - $start + 1;
    if ($partial) {
        http_response_code(206);
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
    }
    header('Content-Length: ' . $length);
    if ($method === 'HEAD') {
        return true;
    }

    $fh = fopen($real, 'rb');
    if ($fh === false) {
        return false;
    }
    if ($start > 0) {
        fseek($fh, $start);
    }
    $left = $length;
    while ($left > 0 && !feof($fh)) {
        $chunk = fread($fh, min(8192, $left));
        if ($chunk === false || $chunk === '') {
            break;
        }
        echo $chunk;
        $left -= strlen($chunk);
    }
    fclose($fh);
    return true;
}
