<?php

$allowed = array_keys(afisha_defaults());

if ($method === 'GET') {
    jsonResponse(['data' => afisha_settings(true)]);
}

if ($method === 'PUT') {
    $raw = getRequestBody();
    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?'
    );
    foreach ($allowed as $key) {
        if (!array_key_exists($key, $raw)) {
            continue;
        }
        $value = trim((string) $raw[$key]);
        $stmt->execute([$key, $value, $value]);
    }
    afisha_settings(true);

    require_once __DIR__ . '/generate_album.php';
    $ids = $pdo->query('SELECT id FROM releases WHERE is_published = 1 ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $rid) {
        generate_album((int) $rid);
    }

    jsonResponse(['success' => true, 'generated' => count($ids)]);
}

jsonError('Метод не разрешен', 405);
