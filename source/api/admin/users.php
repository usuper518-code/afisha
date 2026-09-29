<?php

$pdo = getDB();

// GET /admin/users – список пользователей
if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    $order = $_GET['order'] ?? 'id';
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $fieldsParam = $_GET['fields'] ?? '';
    $search = $_GET['search'] ?? null; // поиск по name
    // Белый список разрешённых полей для SELECT и ORDER BY
    $allowedFields = ['id', 'nickname', 'email', 'level', 'created_at'];
    $allowedOrder = ['id', 'nickname', 'email', 'level', 'created_at'];

    // Валидация направления сортировки
    if (!in_array($direction, ['ASC', 'DESC'])) {
        $direction = 'DESC';
    }
    // Валидация поля сортировки
    if (!in_array($order, $allowedOrder)) {
        $order = 'id';
    }
    // Формируем SELECT поля
    $selectFields = [];
    foreach (explode(',', $fieldsParam) as $f) {
        $f = trim($f);
        if (in_array($f, $allowedFields)) {
            $selectFields[] = $f;
        }
    }
    if (empty($selectFields)) {
        $selectFields = ['*'];
    }

    // Базовый SQL
    $sql = "SELECT " . implode(', ', $selectFields) . " FROM users";
    $params = [];
    $whereConditions = [];

    // Поиск
    if ($search) {
        $whereConditions[] = "(nickname LIKE ? OR email LIKE ?)";
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
    }

    // Собираем WHERE
    if ($whereConditions) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    $sql .= " ORDER BY $order $direction LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countSql = "SELECT COUNT(*) FROM users";
    if ($whereConditions) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $users, 'total' => (int) $total]);
}

// GET /admin/users?id={id} – один пользователь
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT id, client_id, nickname, email, avatar_url, level, created_at FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        jsonError('Пользователь не найден', 404);
    }

    // Статистика
    $stmtStats = $pdo->prepare("SELECT 
        (SELECT COUNT(*) FROM events WHERE user_id = ? AND event_type = 'play') AS plays,
        (SELECT COUNT(*) FROM events WHERE user_id = ? AND event_type = 'rating') AS ratings,
        (SELECT COUNT(*) FROM reviews WHERE user_id = ?) AS reviews,
        (SELECT COUNT(*) FROM events WHERE user_id = ? AND event_type = 'reaction') AS reactions,
        (SELECT COUNT(*) FROM events WHERE user_id = ? AND event_type = 'share') AS shares
    ");
    $stmtStats->execute([$id, $id, $id, $id, $id]);
    $user['stats'] = $stmtStats->fetch(PDO::FETCH_ASSOC);

    // История событий (последние 50)
    $stmtEvents = $pdo->prepare("SELECT event_type, created_at 
                                 FROM events WHERE user_id = ? 
                                 ORDER BY created_at DESC LIMIT 10");
    $stmtEvents->execute([$id]);
    $user['events'] = $stmtEvents->fetchAll(PDO::FETCH_ASSOC);

    // Отзывы пользователя
    $stmtReviews = $pdo->prepare("SELECT r.*, rel.title AS entity_title
                                  FROM reviews r 
                                  JOIN releases rel ON r.release_id = rel.id
                                  WHERE r.user_id = ? 
                                  ORDER BY r.created_at DESC LIMIT 5");
    $stmtReviews->execute([$id]);
    $user['reviews'] = $stmtReviews->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse($user);
}

function chkData($data, $method) {
    $errors = [];
    $warnings = [];
    $newData = [];

    // Никнейм
    if (isset($data['nickname'])) {
        $data['nickname'] = trim($data['nickname']);
        if ($data['nickname'] === '') {
            $errors[] = ['field' => 'nickname', 'message' => 'Никнейм не может быть пустым'];
        } else {
            $maxLen = 100;
            if (mb_strlen($data['nickname']) > $maxLen) {
                $warnings[] = ['field' => 'nickname', 'message' => 'Ник обрезан до ' . $maxLen . ' символов'];
                $data['nickname'] = mb_substr($data['nickname'], 0, $maxLen);
                $newData['nickname'] = $data['nickname'];
            }
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'nickname', 'message' => 'Требуется никнейм'];
    }

    // Email
    if (isset($data['email'])) {
        $data['email'] = trim($data['email']);
        if ($data['email'] === '') {
            $errors[] = ['field' => 'email', 'message' => 'Email не может быть пустым'];
        } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = ['field' => 'email', 'message' => 'Некорректный email'];
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'email', 'message' => 'Требуется email'];
    }

    // Уровень
    if (isset($data['level'])) {
        $data['level'] = (int) $data['level'];
        if ($data['level'] < 0 || $data['level'] > 5) {
            $errors[] = ['field' => 'level', 'message' => 'Уровень должен быть от 0 до 5'];
        }
    }

    // URL аватара
    if (isset($data['avatar_url'])) {
        $data['avatar_url'] = trim($data['avatar_url']);
        $maxLen = 255;
        if (mb_strlen($data['avatar_url']) > $maxLen) {
            $errors[] = ['field' => 'avatar_url', 'message' => 'Длина URL аватара более ' . $maxLen . ' символов'];
        }
    }

    if (!empty($errors)) {
        jsonErrorExtend($errors, $warnings, 422);
    }
    return ['data' => $data, 'warnings' => $warnings, 'newData' => $newData];
}

// PUT /admin/users?id={id} – обновление
if ($method === 'PUT' && $id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для создания', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $fields = [];
    $params = [];

    foreach (['nickname', 'email', 'avatar_url', 'level'] as $f) {
        if (array_key_exists($f, $data)) {
            $fields[] = "$f = ?";
            $params[] = $data[$f];
        }
    }
    if (empty($fields)) {
        jsonError('Нет данных для обновления', 400);
    }
    $params[] = $id;

    try {
        $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['success' => true, 'warnings' => $result['warnings'], 'newData' => $result['newData']]);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) {
            jsonError('Пользователь с таким email или никнеймом уже существует', 409);
        }
        throw $e;
    }
}

// DELETE /admin/users?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Пользователь не найден', 404);
    }
    jsonResponse(['success' => true]);
}

jsonError('Метод не разрешен', 405);
