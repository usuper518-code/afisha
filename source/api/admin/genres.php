<?php

$pdo = getDB();

// GET /admin/genres – список
if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    $order = $_GET['order'] ?? 'id';
    if ($limit < 1) {
        $limit = 1;
    }
    if ($limit > 50) {
        $limit = 50;
    }
    if ($offset < 0) {
        $offset = 0;
    }
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $fieldsParam = $_GET['fields'] ?? '';
    $search = $_GET['search'] ?? null; // поиск по name
    // Белый список разрешённых полей для SELECT и ORDER BY
    $allowedFields = ['id', 'name', 'slug'];
    $allowedOrder = ['id', 'name', 'slug'];

    // Валидация направления сортировки
    if (!in_array($direction, ['ASC', 'DESC'])) {
        $direction = 'DESC';
    }
    // Валидация поля сортировки
    if (!in_array($order, $allowedOrder)) {
        $order = 'id';
    }
    // Формируем список полей для SELECT
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
    $sql = "SELECT " . implode(', ', $selectFields) . " FROM genres";
    $params = [];
    $whereConditions = [];

    // Поиск
    if ($search) {
        $whereConditions[] = "name LIKE ?";
        $params[] = '%' . $search . '%';
    }

    // Собираем WHERE
    if ($whereConditions) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    $sql .= " ORDER BY $order $direction LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $genres = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Общее количество с учётом поиска
    $countSql = "SELECT COUNT(*) FROM genres";
    if ($whereConditions) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $genres, 'total' => (int) $total]);
}

// GET /admin/genres?id={id}
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM genres WHERE id = ?");
    $stmt->execute([$id]);
    $genre = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$genre) {
        jsonError('Не найден', 404);
    }

    jsonResponse($genre);
}

function chkData($data, $method) {
    $errors = [];
    $warnings = [];
    $newData = [];

    //Название
    if (isset($data['name'])) {
        $data['name'] = trim($data['name'] ?? '');
        if (!$data['name']) {
            $errors[] = ['field' => 'name', 'message' => 'Название не может быть пустым'];
        }
        $maxLen = 255;
        if (mb_strlen($data['name']) > $maxLen) {
            $warnings[] = ['field' => 'name', 'message' => 'Название обрезано до ' . $maxLen . ' символов'];
            $data['name'] = mb_substr($data['name'], 0, $maxLen);
            $newData['name'] = $data['name'];
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'name', 'message' => 'Требуется название'];
    }

    //Код
    if (isset($data['slug'])) {
        $data['slug'] = trim($data['slug'] ?? '');
        if (!$data['slug']) {
            $errors[] = ['field' => 'slug', 'message' => 'Код не может быть пустым'];
        }
        $maxLen = 255;
        if (mb_strlen($data['slug']) > $maxLen) {
            $warnings[] = ['field' => 'slug', 'message' => 'Код обрезан до ' . $maxLen . ' символов'];
            $data['slug'] = mb_substr($data['slug'], 0, $maxLen);
            $newData['slug'] = $data['slug'];
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'slug', 'message' => 'Требуется код'];
    }

    if (!empty($errors)) {
        jsonErrorExtend($errors, $warnings, 422);
    }
    return ['data' => $data, 'warnings' => $warnings, 'newData' => $newData];
}

// POST /admin/genres – создание тега
if ($method === 'POST' && !$id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для создания', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    try {
        $stmt = $pdo->prepare("INSERT INTO genres (name, slug) VALUES (?, ?)");
        $stmt->execute([
            $data['name'],
            $data['slug']]
        );
        $newId = $pdo->lastInsertId();
        jsonResponseWithWarnings(['id' => $newId, 'warnings' => $result['warnings'], 'newData' => $result['newData']], 201);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) {
            jsonError('Тег с таким названием или кодом уже существует', 409);
        }
        throw $e;
    }
}

// PUT /admin/genres?id={id} - обновление тега
if ($method === 'PUT' && $id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для обновления', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $stmtCheck = $pdo->prepare("SELECT id FROM genres WHERE id = ?");
    $stmtCheck->execute([$id]);
    if (!$stmtCheck->fetch(PDO::FETCH_ASSOC)) {
        jsonError('Тег не найден', 404);
    }

    $fields = [];
    $params = [];
    foreach (['name', 'slug'] as $f) {
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
        $sql = "UPDATE genres SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        if ($stmt->rowCount() === 0) {
            //jsonError('Тег не изменился', 404);   
        }
        jsonResponse(['success' => true, 'warnings' => $result['warnings'], 'newData' => $result['newData']]);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) {
            jsonError('Тег с таким названием или кодом уже существует', 409);
        }
        throw $e;
    }
}

// DELETE /admin/genres?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("DELETE FROM genres WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Тег не найден', 404);
    }
    jsonResponse(['success' => true]);
}

jsonError('Обработчик не найден', 404);
