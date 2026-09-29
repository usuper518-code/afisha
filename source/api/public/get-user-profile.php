<?php
//get-user-profile.php
if ($method !== 'GET') {
    jsonError('Метод не разрешен', 405);
}

// GET — получить данные пользователя
$clientId = getClientId();
if (!$clientId) {
    jsonError('Не передан идентификатор клиента', 400);
}

$pdo = getDB();
$stmt = $pdo->prepare("SELECT nickname AS name, email FROM users WHERE client_id = ?");
$stmt->execute([$clientId]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    jsonError('Пользователь не найден', 404);
}

jsonResponse(['success' => true, 'name' => $user['name'], 'email' => $user['email']]);