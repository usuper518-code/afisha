<?php

$pdo = getDB();

// GET /admin/artists – список
if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    $order = $_GET['order'] ?? 'id';
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $fieldsParam = $_GET['fields'] ?? '';
    $search = $_GET['search'] ?? null;
    $isActive = $_GET['is_active'] ?? null;
    // Белый список разрешённых полей для SELECT и ORDER BY
    $allowedFields = ['id', 'name', 'slug', 'voice_type', 'description', 'is_active', 'sort_order', 'uuid', 'created_at', 'updated_at'];
    $allowedOrder = ['id', 'name', 'voice_type', 'sort_order', 'created_at'];

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

    $sql = "SELECT " . implode(', ', $selectFields) . " FROM artists";
    $params = [];
    $whereConditions = [];

    if ($search) {
        $whereConditions[] = "name LIKE ?";
        $params[] = '%' . $search . '%';
    }

    if ($isActive !== null && $isActive !== '') {
        $isActive = (int) $isActive;
        $whereConditions[] = "is_active = ?";
        $params[] = $isActive;
    }

    if (!empty($whereConditions)) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    $sql .= " ORDER BY $order $direction LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $artists = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countSql = "SELECT COUNT(*) FROM artists";
    if (!empty($whereConditions)) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $artists, 'total' => (int) $total]);
}

// GET /admin/artists?id={id}
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ?");
    $stmt->execute([$id]);
    $artist = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$artist) {
        jsonError('Артист не найден', 404);
    }

    $artist['cover_url'] = get_avatar_url($artist['uuid']);

    // Треки артиста
    $stmtT = $pdo->prepare("SELECT t.id, t.title FROM track_artists ta JOIN tracks t ON ta.track_id = t.id WHERE ta.artist_id = ? ORDER BY t.title");
    $stmtT->execute([$id]);
    $artist['tracks'] = $stmtT->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse($artist);
}

function chkData($data, $method) {
    $errors = [];
    $warnings = [];
    $newData = [];

    // Имя
    if (isset($data['name'])) {
        $data['name'] = trim($data['name']);
        if ($data['name'] === '') {
            $errors[] = ['field' => 'name', 'message' => 'Имя не может быть пустым'];
        } else {
            $maxLen = 255;
            if (mb_strlen($data['name']) > $maxLen) {
                $warnings[] = ['field' => 'name', 'message' => 'Имя обрезано до ' . $maxLen . ' символов'];
                $data['name'] = mb_substr($data['name'], 0, $maxLen);
                $newData['name'] = $data['name'];
            }
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'name', 'message' => 'Требуется имя'];
    }

    // Код
    if (isset($data['slug'])) {
        $data['slug'] = trim($data['slug']);
        if ($data['slug'] === '') {
            $errors[] = ['field' => 'slug', 'message' => 'Код не может быть пустым'];
        } else {
            $maxLen = 255;
            if (mb_strlen($data['slug']) > $maxLen) {
                $warnings[] = ['field' => 'slug', 'message' => 'Код обрезан до ' . $maxLen . ' символов'];
                $data['slug'] = mb_substr($data['slug'], 0, $maxLen);
                $newData['slug'] = $data['slug'];
            }
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'slug', 'message' => 'Требуется код'];
    }

    // Тип голоса
    if (isset($data['voice_type'])) {
        $data['voice_type'] = trim($data['voice_type']);
        $maxLen = 255;
        if (mb_strlen($data['voice_type']) > $maxLen) {
            $warnings[] = ['field' => 'voice_type', 'message' => 'Тип голоса обрезан до ' . $maxLen . ' символов'];
            $data['voice_type'] = mb_substr($data['voice_type'], 0, $maxLen);
            $newData['voice_type'] = $data['voice_type'];
        }
    }

    // Описание – просто строка, без ограничений
    // Порядок сортировки
    if (isset($data['sort_order'])) {
        $data['sort_order'] = (int) $data['sort_order'];
        if ($data['sort_order'] < 0 || $data['sort_order'] > 999) {
            $errors[] = ['field' => 'sort_order', 'message' => 'Порядок должен быть от 0 до 999'];
        }
    }

    // Активность
    if (isset($data['is_active'])) {
        $data['is_active'] = (int) (bool) $data['is_active'];
    }

    if (!empty($errors)) {
        jsonErrorExtend($errors, $warnings, 422);
    }
    return ['data' => $data, 'warnings' => $warnings, 'newData' => $newData];
}

// POST /admin/artists – создание
if ($method === 'POST' && !$id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для создания', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    try {
        $stmt = $pdo->prepare("INSERT INTO artists (name, slug, voice_type, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['name'],
            $data['slug'],
            $data['voice_type'] ?? null,
            $data['description'] ?? null,
            $data['is_active'] ?? 0,
            $data['sort_order'] ?? 0
        ]);
        $newId = $pdo->lastInsertId();
        jsonResponseWithWarnings(['id' => $newId, 'warnings' => $result['warnings'], 'newData' => $result['newData']], 201);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) {
            jsonError('Артист с таким кодом уже существует', 409);
        }
        throw $e;
    }
}

// PUT /admin/artists?id={id} – обновление
if ($method === 'PUT' && $id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для обновления', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $stmtCheck = $pdo->prepare("SELECT id FROM artists WHERE id = ?");
    $stmtCheck->execute([$id]);
    if (!$stmtCheck->fetch(PDO::FETCH_ASSOC)) {
        jsonError('Артист не найден', 404);
    }

    $allowedFields = ['name', 'slug', 'voice_type', 'description', 'is_active', 'sort_order'];
    $fields = [];
    $params = [];
    foreach ($allowedFields as $f) {
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
        $sql = "UPDATE artists SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['success' => true, 'warnings' => $result['warnings'], 'newData' => $result['newData']]);
    } catch (PDOException $e) {
        if ($e->errorInfo[1] == 1062) {
            jsonError('Артист с таким кодом уже существует', 409);
        }
        throw $e;
    }
}

// DELETE /admin/artists?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT uuid FROM artists WHERE id = ?");
    $stmt->execute([$id]);
    $artist = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$artist) {
        jsonError('Артист не найден', 404);
    }

    $stmt = $pdo->prepare("DELETE FROM artists WHERE id = ?");
    $stmt->execute([$id]);

    $artistDir = UPLOAD_DIR . 'artist/' . $artist['uuid'];
    if (is_dir($artistDir)) {
        $files = glob("$artistDir/*");
        if ($files) {
            foreach ($files as $file) {
                if (is_file($file))
                    unlink($file);
            }
        }
        rmdir($artistDir);
    }

    jsonResponse(['success' => true]);
}

jsonError('Обработчик не найден', 404);
