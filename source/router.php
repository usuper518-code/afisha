<?php
// Роутер встроенного сервера PHP для беты:
//   php -S 0.0.0.0:8080 -t source source/router.php
// Существующие файлы отдаёт сам сервер, /api/* уходит в api/index.php.

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
$file = __DIR__ . $uri;

if ($uri !== '/' && is_file($file)) {
    return false;
}

// /admin/ и другие каталоги — как DirectoryIndex на Apache.
$dir = rtrim($file, '/');
if ($uri !== '/' && is_dir($dir)) {
    $index = $dir . '/index.html';
    if (is_file($index)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($index);
        return true;
    }
}

if (str_starts_with($uri, '/api/') || $uri === '/api') {
    require __DIR__ . '/api/index.php';
    return true;
}

if ($uri === '/' && is_file(__DIR__ . '/index.html')) {
    return false;
}

http_response_code(404);
if (is_file(__DIR__ . '/404.html')) {
    readfile(__DIR__ . '/404.html');
    return true;
}

echo 'Not found';
return true;
