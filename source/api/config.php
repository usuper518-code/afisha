<?php
//config.php

// Настройки базы данных
define('DB_HOST', 'localhost');
define('DB_NAME', 'catalog');
define('DB_USER', 'root');
define('DB_PASS', '12345');

// API-ключ для админки
define('ADMIN_API_KEY', '12345');

// Название, слоган, состав и прочие тексты афиши лежат в таблице settings.
define('MAIL_FROM', '');

define('BASE_URL', 'https://site');
define('ROOT_DIR', __DIR__ . '/..');
define('ALBUMS_DIR', __DIR__ . '/../albums');
define('TEMPLATES_DIR', __DIR__ . '/../templates');

// Пути для загрузок
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_COVER_SIZE', 10); // MB
define('MAX_VIDEO_SIZE', 10); // MB
// Обложки и ролики приводим к одному квадрату. Других размеров в загрузке нет.
define('MEDIA_SIDE', 628);
// Путь к ffmpeg. Пустая строка — ролик сохраняется как загружен, без обрезки в квадрат.
define('FFMPEG_PATH', '/usr/bin/ffmpeg');
define('MAX_MP3_SIZE', 50); // MB
// Путь к библиотеке getID3
define('GETID3_PATH', __DIR__ . '/vendor/getid3/getid3.php');
define('TCPDF_PATH', __DIR__ . '/vendor/TCPDF/tcpdf.php'); // 6.11.4, нужен модуль curl

// Маппинг эмоций
define('EMOTION_MAP', [
    'A' => ['emoji' => '🔥', 'name' => 'Страсть'],
    'B' => ['emoji' => '💧', 'name' => 'Печаль'],
    'C' => ['emoji' => '✨', 'name' => 'Радость'],
    'D' => ['emoji' => '⚡', 'name' => 'Драйв'],
    'E' => ['emoji' => '🌿', 'name' => 'Горечь'],
    'F' => ['emoji' => '🎭', 'name' => 'Загадка'],
    'G' => ['emoji' => '🕯️', 'name' => 'Нежность'],
]);

// Логирование ошибок
//ini_set('display_errors', 1); // Показывать ошибки прямо в выводе
//ini_set('display_startup_errors', 1); // Показывать ошибки, возникающие при старте PHP
error_reporting(E_ALL); // Включить все уровни ошибок, включая E_NOTICE и E_WARNING
ini_set('log_errors', 1); // Также записывать ошибки в лог-файл
ini_set('error_log', __DIR__ . '/../logs/php_errors.log'); // Путь к лог-файлу

// Заголовки CORS. Посетитель ходит на API с того же домена, личность
// держится в cookie сессии (см. ensureVisitorSession), а не в заголовке.
if (PHP_SAPI !== 'cli') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-Client-Id');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}