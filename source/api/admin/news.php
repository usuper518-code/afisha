<?php

$pdo = getDB();

// GET /admin/news – список
if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    if ($limit < 1) {
        $limit = 1;
    }
    if ($limit > 50) {
        $limit = 50;
    }
    if ($offset < 0) {
        $offset = 0;
    }
    $order = $_GET['order'] ?? 'id';
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $fieldsParam = $_GET['fields'] ?? '';
    $search = $_GET['search'] ?? null;
    $allowedFields = ['id', 'title', 'content', 'created_at', 'is_published'];
    $allowedOrder = ['id', 'title', 'created_at', 'is_published'];

    if (!in_array($direction, ['ASC', 'DESC'])) {
        $direction = 'DESC';
    }
    if (!in_array($order, $allowedOrder)) {
        $order = 'id';
    }

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

    $sql = "SELECT " . implode(', ', $selectFields) . " FROM news";
    $params = [];
    $whereConditions = [];

    if ($search) {
        $whereConditions[] = "title LIKE ?";
        $params[] = '%' . $search . '%';
    }

    if ($whereConditions) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    $sql .= " ORDER BY $order $direction LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $news = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countSql = "SELECT COUNT(*) FROM news";
    if ($whereConditions) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $news, 'total' => (int) $total]);
    return;
}

// GET /admin/news?id={id}
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM news WHERE id = ?");
    $stmt->execute([$id]);
    $newsItem = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$newsItem) {
        jsonError('Новость не найдена', 404);
    }
    jsonResponse($newsItem);
    return;
}

function chkData($data, $method) {
    $errors = [];
    $warnings = [];
    $newData = [];

    if (isset($data['title'])) {
        $data['title'] = trim($data['title'] ?? '');
        if ($data['title'] === '') {
            $errors[] = ['field' => 'title', 'message' => 'Заголовок не может быть пустым'];
        }
        $maxLen = 255;
        if (mb_strlen($data['title']) > $maxLen) {
            $warnings[] = ['field' => 'title', 'message' => 'Заголовок обрезан до ' . $maxLen . ' символов'];
            $data['title'] = mb_substr($data['title'], 0, $maxLen);
            $newData['title'] = $data['title'];
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'title', 'message' => 'Требуется заголовок'];
    }

    if (isset($data['content'])) {
        $data['content'] = trim($data['content'] ?? '');
        if ($data['content'] === '' && $method === 'POST') {
            $errors[] = ['field' => 'content', 'message' => 'Текст новости не может быть пустым'];
        }
    }

    if (isset($data['is_published'])) {
        $data['is_published'] = (int) (bool) $data['is_published'];
    }

    if (!empty($errors)) {
        jsonErrorExtend($errors, $warnings, 422);
    }
    return ['data' => $data, 'warnings' => $warnings, 'newData' => $newData];
}

// POST /admin/news – создание
if ($method === 'POST' && !$id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для создания', 400);
    }
    $result = chkData($raw, 'POST');
    $data = $result['data'];

    $stmt = $pdo->prepare("INSERT INTO news (title, content, is_published) VALUES (?, ?, ?)");
    $stmt->execute([
        $data['title'],
        $data['content'] ?? '',
        $data['is_published'] ?? 1
    ]);
    $newId = $pdo->lastInsertId();
    jsonResponseWithWarnings(['id' => $newId, 'warnings' => $result['warnings'], 'newData' => $result['newData']], 201);
    return;
}

// PUT /admin/news?id={id} – обновление
if ($method === 'PUT' && $id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonResponse(['success' => true, 'message' => 'Нет данных для обновления']);
        return;
    }
    $result = chkData($raw, 'PUT');
    $data = $result['data'];

    $stmtCheck = $pdo->prepare("SELECT id FROM news WHERE id = ?");
    $stmtCheck->execute([$id]);
    if (!$stmtCheck->fetch()) {
        jsonError('Новость не найдена', 404);
    }

    $fields = [];
    $params = [];
    foreach (['title', 'content', 'is_published'] as $f) {
        if (array_key_exists($f, $data)) {
            $fields[] = "$f = ?";
            $params[] = $data[$f];
        }
    }
    if (empty($fields)) {
        jsonResponse(['success' => true, 'message' => 'Нет данных для обновления']);
        return;
    }
    $params[] = $id;

    $sql = "UPDATE news SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    jsonResponse(['success' => true, 'warnings' => $result['warnings'], 'newData' => $result['newData']]);
    return;
}

// DELETE /admin/news?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("DELETE FROM news WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Новость не найдена', 404);
    }
    jsonResponse(['success' => true]);
    return;
}

jsonError('Обработчик не найден', 404);
