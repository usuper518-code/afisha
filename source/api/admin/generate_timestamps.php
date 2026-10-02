<?php

if ($method !== 'GET') {
    jsonError('Метод не разрешен', 405);
}

if (!$id) {
    jsonError('Необходим ИД трека', 400);
}

$pdo = getDB();
$stmt = $pdo->prepare("SELECT * FROM tracks WHERE id = ?");
$stmt->execute([$id]);
$track = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$track) {
    jsonError('Трек не найден', 404);
}

if (!defined('WHISPER_VENV') || WHISPER_VENV === '' || !is_dir(WHISPER_VENV)) {
    jsonError('Генерация таймкодов не настроена', 501);
}

// Пути (настройки берутся из config.php)
$pythonScript = WHISPER_VENV . '/whisper1.py'; // C:/py/aligner/whisper1.py
$pythonExe = WHISPER_VENV . '/Scripts/python'; // C:/py/aligner/Scripts/python
$tmpPath = sys_get_temp_dir();
$tmpPath = WHISPER_VENV . '/tmp';

$audioPath = UPLOAD_DIR . 'track/' . $track['uuid'] . '/audio.mp3';
$lyricsPath = $tmpPath . '/lyrics_' . $track['uuid'] . '.txt';
$outputLrc = $tmpPath . '/lyrics_synced_' . $track['uuid'] . '.lrc';
$outputJson = $tmpPath . '/lyrics_aligned_' . $track['uuid'] . '.json';

// Сохраняем текст во временный файл
file_put_contents($lyricsPath, $track['lyrics']);

// Команда: python скрипт аудио текст выход_lrc выход_json
$command = escapeshellcmd($pythonExe) . " " .
        escapeshellarg($pythonScript) . " " .
        escapeshellarg($audioPath) . " " .
        escapeshellarg($lyricsPath) . " " .
        escapeshellarg($outputLrc) . " " .
        escapeshellarg($outputJson) . " 2>&1";

$output = [];
$returnCode = 0;

// Устанавливаем рабочую папку для процесса
$currentDir = getcwd();
chdir(WHISPER_VENV);
exec($command, $output, $returnCode);
chdir($currentDir);

// Логируем вывод для отладки
//error_log("Whisperx pipeline output: " . implode("\n", $output));

if ($returnCode !== 0 || !file_exists($outputJson)) {
    jsonError('Ошибка генерации таймкодов', 500);
}

$timed = json_decode(file_get_contents($outputJson), true);
if (!$timed) {
    jsonError('Невалидный JSON от скрипта', 500);
}

// Сохраняем в БД
$stmt = $pdo->prepare("UPDATE tracks SET lyrics_timed = ? WHERE id = ?");
$stmt->execute([json_encode($timed, JSON_UNESCAPED_UNICODE), $id]);

// Убираем временные файлы
//@unlink($lyricsPath);
//@unlink($outputLrc);
//@unlink($outputJson);

echo json_encode(['success' => true, 'lyrics_timed' => $timed]);
