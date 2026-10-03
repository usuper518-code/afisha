<?php
//index.php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/functions.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = trim($path, '/');
$parts = explode('/', $path);

if ($parts[0] === 'api') {
    array_shift($parts);
}

$resource = $parts[0] ?? '';
$id = $_GET['id'] ?? null;

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    // Публичные эндпоинты
    $publicFiles = ['reviews', 'reactions', 'rate-album', 'feedback', 'sitemap', 'news', 'get-user-profile', 'events', 'remind'];
    if (in_array($resource, $publicFiles)) {
        ensureVisitorSession();
        $publicFile = __DIR__ . '/public/' . $resource . '.php';
        if (file_exists($publicFile)) {
            require_once $publicFile;
            exit;
        }
        jsonError('Обработчик не найден', 404);
    }

    // Административные эндпоинты
    if ($resource === 'admin') {
        checkAdminAuth();
        $resource = $parts[1] ?? '';
        $action = $parts[2] ?? '';
        if (!preg_match('/^[a-z0-9_-]{1,64}$/', $resource)) {
            jsonError('Обработчик не найден', 404);
        }
        $adminFile = __DIR__ . '/admin/' . $resource . '.php';
        if (is_file($adminFile)) {
            require_once $adminFile;
            exit;
        }
        jsonError('Обработчик не найден', 404);
    }

    // Эндпоинт для получения маппинга эмоций (может использоваться в админке)
    if ($resource === 'emotions' && $method === 'GET') {
        jsonResponse(EMOTION_MAP);
    }

    jsonError('Обработчик не найден', 404);

} catch (AfishaSettingsException $e) {
    error_log($e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    jsonError($e->getMessage(), 500);
} catch (Exception $e) {
    error_log($e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    jsonError('Ошибка сервера', 500);
}
