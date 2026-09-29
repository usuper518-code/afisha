<?php
//remind.php

if ($method !== 'POST') {
    jsonError('Метод не разрешен', 405);
}

$sessionId = getClientId();
if (!$sessionId) {
    jsonError('Не передан идентификатор клиента', 400);
}    

$data = getRequestBody();
$email = trim($data['email'] ?? '');
$name = trim($data['name'] ?? '');
$subscribe = !empty($data['subscribe']);

if (!$email || !$albumSlug) {
    jsonError('Необходимы имя и email', 400);
}

$pdo = getDB();
getOrCreateUser($pdo, $sessionId, [
    'nickname' => $name,
    'email' => $email,
    'subscribe' => $subscribe
]);

jsonResponse(['success' => true]);