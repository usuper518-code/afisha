<?php

if ($method !== 'POST') {
    jsonError('Метод не разрешен', 405);
}

function rejectBadUpload(array $file): void {
    $err = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err === UPLOAD_ERR_OK) {
        return;
    }
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
        jsonError('Файл больше лимита сервера (' . ini_get('upload_max_filesize') . ')', 400);
    }
    jsonError('Ошибка загрузки', 400);
}

// POST /admin/upload/release_cover?id={id}
if ($action === 'release_cover' && $id) {
    if (!isset($_FILES['file'])) {
        jsonError('Файл отсутствует', 400);
    }

    $file = $_FILES['file'];
    rejectBadUpload($file);
    if ($file['size'] > MAX_COVER_SIZE * 1024 * 1024) {
        jsonError('Файл больше ' . MAX_COVER_SIZE . ' MB', 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) {
        jsonError('Неверный тип файла', 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT uuid FROM releases WHERE id = ?");
    $stmt->execute([$id]);
    $release = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$release) {
        jsonError('Релиз не найден', 404);
    }

    // Создаём папку /uploads/release/{uuid}/
    $targetDir = UPLOAD_DIR . 'release/' . $release['uuid'];
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $targetPath = $targetDir . '/cover.jpg';

    if (!optimizeImage($file['tmp_name'], $targetPath)) {
        jsonError('Ошибка сохранения', 500);
    }

    $url = get_cover_url($release['uuid']);
    jsonResponse(['url' => $url]);
}

// POST /admin/upload/track_cover?id={id}
if ($action === 'track_cover' && $id) {
    if (!isset($_FILES['file'])) {
        jsonError('Файл отсутствует', 400);
    }

    $file = $_FILES['file'];
    rejectBadUpload($file);
    if ($file['size'] > MAX_COVER_SIZE * 1024 * 1024) {
        jsonError('Файл больше ' . MAX_COVER_SIZE . ' MB', 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) {
        jsonError('Неверный тип файла', 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT uuid FROM tracks WHERE id = ?");
    $stmt->execute([$id]);
    $track = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$track) {
        jsonError('Трек не найден', 404);
    }

    // Создаём папку /uploads/track/{uuid}/
    $targetDir = UPLOAD_DIR . 'track/' . $track['uuid'];
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $targetPath = $targetDir . '/cover.jpg';

    if (!optimizeImage($file['tmp_name'], $targetPath)) {
        jsonError('Ошибка сохранения', 500);
    }

    $url = get_cover_url($track['uuid'], 'track');
    jsonResponse(['url' => $url]);
}

// POST /admin/upload/track_video?id={id}
if ($action === 'track_video' && $id) {
    if (!isset($_FILES['file'])) {
        jsonError('Файл отсутствует', 400);
    }

    $file = $_FILES['file'];
    rejectBadUpload($file);
    if ($file['size'] > MAX_VIDEO_SIZE * 1024 * 1024) {
        jsonError('Файл больше ' . MAX_VIDEO_SIZE . ' MB', 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp'], true)) {
        jsonError('Неверный тип файла', 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT uuid FROM tracks WHERE id = ?");
    $stmt->execute([$id]);
    $track = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$track) {
        jsonError('Трек не найден', 404);
    }

    // Создаём папку /uploads/track/{uuid}/
    $targetDir = UPLOAD_DIR . 'track/' . $track['uuid'];
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $targetPath = $targetDir . '/video.mp4';

    if (!fitSquareVideo($file['tmp_name'], $targetPath)) {
        jsonError('Ошибка сохранения', 500);
    }

    $url = get_video_url($track['uuid'], 'track');
    jsonResponse(['url' => $url]);
}

// POST /admin/upload/artist_cover?id={id}
if ($action === 'artist_cover' && $id) {
    if (!isset($_FILES['file'])) {
        jsonError('Файл отсутствует', 400);
    }

    $file = $_FILES['file'];
    rejectBadUpload($file);
    if ($file['size'] > MAX_COVER_SIZE * 1024 * 1024) {
        jsonError('Файл больше ' . MAX_COVER_SIZE . ' MB', 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) {
        jsonError('Неверный тип файла', 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT uuid FROM artists WHERE id = ?");
    $stmt->execute([$id]);
    $artist = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$artist) {
        jsonError('Артист не найден', 404);
    }

    $targetDir = UPLOAD_DIR . 'artist/' . $artist['uuid'];
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $targetPath = $targetDir . '/avatar.jpg';

    if (!optimizeImage($file['tmp_name'], $targetPath)) {
        jsonError('Ошибка сохранения', 500);
    }

    $url = get_avatar_url($artist['uuid']);
    jsonResponse(['url' => $url]);
}

// POST /admin/upload/audio?id={id}
if ($action === 'audio' && $id) {
    if (!isset($_FILES['file'])) {
        jsonError('Файл отсутствует', 400);
    }

    $file = $_FILES['file'];
    rejectBadUpload($file);
    if ($file['size'] > MAX_MP3_SIZE * 1024 * 1024) {
        jsonError('Файл больше ' . MAX_MP3_SIZE . ' MB', 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    $allowedMime = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mp3', 'audio/x-mpeg'];
    if (!in_array($mime, $allowedMime)) {
        jsonError('Неверный тип файла. Ожидается MP3', 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT uuid FROM tracks WHERE id = ?");
    $stmt->execute([$id]);
    $track = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$track) {
        jsonError('Трек не найден', 404);
    }

    // Создаём папку /uploads/track/{uuid}/
    $targetDir = UPLOAD_DIR . 'track/' . $track['uuid'];
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $targetPath = $targetDir . '/audio.mp3';

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        jsonError('Ошибка сохранения', 500);
    }

    // Получаем длительность аудио
    $duration = getAudioDuration($targetPath);
    if ($duration > 0) {
        $stmt = $pdo->prepare("UPDATE tracks SET duration = ? WHERE id = ?");
        $stmt->execute([$duration, $id]);
    }

    $url = get_audio_url($track['uuid']);
    jsonResponse(['url' => $url, 'duration' => $duration]);
}

jsonError('Обработчик не найден', 404);
