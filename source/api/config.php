<?php
//config.php

// Настройки базы данных
define('DB_HOST', 'localhost');
define('DB_NAME', 'catalog');
define('DB_USER', 'root');
define('DB_PASS', '12345');

// API-ключ для админки
define('ADMIN_API_KEY', '12345');

// НАСТРОЙКИ САЙТА
define('SITE_TITLE', 'Студия');
define('SITE_TAGLINE', 'Акустический театр.');
define('ABOUT_TEXT', 'Студия — это театр.');

define('MAIL_FROM', '');

define('METRIKA_ID', '0');
define('STIHI_URL', '');
define('DEFAULT_AUTHOR', 'ТТТ');
define('AUTHOR_BIO', ''); // короткий текст для секции «Автор» на странице about.html; если пусто — секция покажет только имя
define('SLOGAN', '');

define('BASE_URL', 'https://site');
define('ROOT_DIR', __DIR__ . '/..');
define('ALBUMS_DIR', __DIR__ . '/../albums');
define('TEMPLATES_DIR', __DIR__ . '/../templates');

// Пути для загрузок
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_COVER_SIZE', 10); // MB
define('MAX_VIDEO_SIZE', 10); // MB
define('MAX_MP3_SIZE', 50); // MB
// Путь к библиотеке getID3
define('GETID3_PATH', __DIR__ . '/vendor/getid3/getid3.php');
define('TCPDF_PATH', __DIR__ . '/vendor/TCPDF/tcpdf.php');

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

// Заголовки CORS (для разработки можно '*', в продакшене замените на конкретный домен)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-Client-Id');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}