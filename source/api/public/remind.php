<?php
//remind.php — «Напомнить о премьере» и флаг рассылки.

if ($method !== 'POST') {
    jsonError('Метод не разрешен', 405);
}

$sessionId = getClientId();
if (!$sessionId) {
    jsonError('Не передан идентификатор клиента', 400);
}

$data = getRequestBody();
$email = trim((string) ($data['email'] ?? ''));
$name = trim((string) ($data['name'] ?? ''));
$subscribe = !empty($data['subscribe']);
$releaseId = (int) ($data['release_id'] ?? 0);

if ($name === '' || $email === '') {
    jsonError('Необходимы имя и email', 400);
}
if (mb_strlen($name) > 100) {
    jsonError('Имя слишком длинное', 400);
}
if (!isSafeEmail($email)) {
    jsonError('Некорректный email', 400);
}
if (!$releaseId) {
    jsonError('Необходим ИД релиза', 400);
}

enforcePublicRate('remind', 5, 20, 3600);

$pdo = getDB();
$stmt = $pdo->prepare("SELECT id, premiere_date, is_published FROM releases WHERE id = ?");
$stmt->execute([$releaseId]);
$release = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$release || !(int) $release['is_published']) {
    jsonError('Релиз не найден', 404);
}
if (!empty($release['premiere_date']) && $release['premiere_date'] < date('Y-m-d')) {
    jsonError('Премьера уже состоялась', 400);
}

try {
    $userId = getOrCreateUser($pdo, $sessionId, [
        'nickname' => $name,
        'email' => $email,
        'subscribe' => $subscribe,
    ]);
} catch (PDOException $e) {
    if ((string) $e->getCode() === '23000') {
        jsonError('Этот email уже используется', 409);
    }
    throw $e;
}

$stmtRemind = $pdo->prepare("INSERT INTO premiere_reminders (user_id, release_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE user_id = user_id");
$stmtRemind->execute([$userId, $releaseId]);

jsonResponse([
    'success' => true,
    'subscribed' => $subscribe,
]);
