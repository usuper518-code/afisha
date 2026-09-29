<?php

$pdo = getDB();

// GET /admin/releases – список с фильтрацией, сортировкой и выбором полей
if ($method === 'GET' && !$id) {
    $limit = (int) ($_GET['limit'] ?? 10);
    $offset = (int) ($_GET['offset'] ?? 0);
    $order = $_GET['order'] ?? 'id';
    $direction = strtoupper($_GET['direction'] ?? 'DESC');

    $search = $_GET['search'] ?? null;
    $type = $_GET['type'] ?? null;
    $genreIds = $_GET['genre_ids'] ?? null;
    $isPublished = $_GET['is_published'] ?? null;
    $fieldsParam = $_GET['fields'] ?? '';

    // Белые списки
    $allowedFields = ['id', 'title', 'slug', 'subtitle', 'description', 'release_year',
        'premiere_date', 'type', 'theme', 'sort_order', 'is_published',
        'is_premiere', 'created_at', 'updated_at', 'uuid'];
    $allowedOrder = ['id', 'title', 'release_year', 'type', 'sort_order', 'is_premiere', 'created_at', 'updated_at'];

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
    $sql = "SELECT " . implode(', ', $selectFields) . " FROM releases";
    $params = [];
    $whereConditions = [];

    // Фильтр по типу
    if ($type) {
        $types = explode(',', $type);
        $placeholders = implode(',', array_fill(0, count($types), '?'));
        $whereConditions[] = "type IN ($placeholders)";
        $params = array_merge($params, $types);
    }

    // Фильтр по жанрам
    if ($genreIds) {
        $genreIdArray = array_map('intval', explode(',', $genreIds));
        if (!empty($genreIdArray)) {
            $placeholders = implode(',', array_fill(0, count($genreIdArray), '?'));
            $whereConditions[] = "EXISTS (SELECT 1 FROM release_genre WHERE release_id = releases.id AND genre_id IN ($placeholders))";
            $params = array_merge($params, $genreIdArray);
        }
    }

    // Поиск по названию
    if ($search) {
        $whereConditions[] = "title LIKE ?";
        $params[] = '%' . $search . '%';
    }

    // Фильтр по статусу публикации
    if ($isPublished !== null && $isPublished !== '') {
        $isPublished = (int) $isPublished;
        $whereConditions[] = "is_published = ?";
        $params[] = $isPublished;
    }

    // Собираем WHERE
    if (!empty($whereConditions)) {
        $sql .= " WHERE " . implode(' AND ', $whereConditions);
    }

    // Сортировка и пагинация
    $sql .= " ORDER BY $order $direction LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $releases = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Общее количество (с теми же фильтрами)
    $countSql = "SELECT COUNT(*) FROM releases";
    if (!empty($whereConditions)) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $releases, 'total' => (int) $total]);
}

// GET /admin/releases?id={id}
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM releases WHERE id = ?");
    $stmt->execute([$id]);
    $release = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$release)
        jsonError('Не найден', 404);

    //cover
    $release['cover_url'] = get_cover_url($release['uuid']);

    // Теги
    $stmtG = $pdo->prepare("SELECT g.id, g.name FROM genres g JOIN release_genre rg ON g.id = rg.genre_id WHERE rg.release_id = ?");
    $stmtG->execute([$id]);
    $release['genres'] = $stmtG->fetchAll(PDO::FETCH_ASSOC);

    // Треки
    $stmtT = $pdo->prepare("SELECT t.id, t.title, t.duration, rt.track_number
                        FROM release_tracks rt
                        JOIN tracks t ON rt.track_id = t.id
                        WHERE rt.release_id = ?
                        ORDER BY rt.track_number");
    $stmtT->execute([$id]);
    $release['tracks'] = $stmtT->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse($release);
}

function chkData($data, $method = 'PUT') {
    $errors = [];
    $warnings = [];
    $newData = [];

    // Название
    if (isset($data['title'])) {
        $data['title'] = trim($data['title']);
        if ($data['title'] === '') {
            $errors[] = ['field' => 'title', 'message' => 'Требуется название'];
        } else {
            $maxLen = 255;
            if (mb_strlen($data['title']) > $maxLen) {
                $warnings[] = ['field' => 'title', 'message' => 'Название обрезано до ' . $maxLen . ' символов'];
                $data['title'] = mb_substr($data['title'], 0, $maxLen);
                $newData['title'] = $data['title'];
            }
        }
    } elseif ($method === 'POST') {
        $errors[] = ['field' => 'title', 'message' => 'Требуется название'];
    }

    // Код
    if (isset($data['slug'])) {
        $data['slug'] = trim($data['slug']);
        if ($data['slug'] === '') {
            $errors[] = ['field' => 'slug', 'message' => 'Требуется код'];
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

    // Подзаголовок
    if (isset($data['subtitle'])) {
        $data['subtitle'] = trim($data['subtitle']);
        $maxLen = 255;
        if (mb_strlen($data['subtitle']) > $maxLen) {
            $warnings[] = ['field' => 'subtitle', 'message' => 'Подзаголовок обрезан до ' . $maxLen . ' символов'];
            $data['subtitle'] = mb_substr($data['subtitle'], 0, $maxLen);
            $newData['subtitle'] = $data['subtitle'];
        }
    }

    // Год
    if (isset($data['release_year'])) {
        $val = trim((string) $data['release_year']);
        if ($val === '') {
            $data['release_year'] = null;
        } else {
            $year = (int) $val;
            if ($year < 1900 || $year > 2200) {
                $errors[] = ['field' => 'release_year', 'message' => 'Год от 1900 до 2200'];
            }
            $data['release_year'] = $year;
        }
    }

    // Дата премьеры (проверка формата)
    if (isset($data['premiere_date'])) {
        if ($data['premiere_date'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['premiere_date'])) {
            $errors[] = ['field' => 'premiere_date', 'message' => 'Неверный формат даты'];
        }
    }

    // Тип
    if (isset($data['type'])) {
        $allowedTypes = ['album', 'single', 'ep', 'compilation', 'remix', 'demo', 'rock_opera', 'musical'];
        if (!in_array($data['type'], $allowedTypes)) {
            $errors[] = ['field' => 'type', 'message' => 'Неверный тип'];
        }
    }

    // Тема — только имя файла theme-*.css, без выхода из каталога
    if (isset($data['theme'])) {
        $theme = (string) $data['theme'];
        $themePath = ROOT_DIR . '/css/themes/theme-' . $theme . '.css';
        if (!preg_match('/^[a-z0-9-]{1,40}$/', $theme) || !is_file($themePath)) {
            $errors[] = ['field' => 'theme', 'message' => 'Неверная тема'];
        }
    }

    // Порядок
    if (isset($data['sort_order'])) {
        $data['sort_order'] = (int) $data['sort_order'];
        if ($data['sort_order'] < 0 || $data['sort_order'] > 999) {
            $errors[] = ['field' => 'sort_order', 'message' => 'Порядок от 0 до 999'];
        }
    }

    // Статусы
    if (isset($data['is_published'])) {
        $data['is_published'] = (int) (bool) $data['is_published'];
    }
    if (isset($data['is_premiere'])) {
        $data['is_premiere'] = (int) (bool) $data['is_premiere'];
    }

    if (!empty($errors)) {
        jsonErrorExtend($errors, $warnings, 422);
    }
    return ['data' => $data, 'warnings' => $warnings, 'newData' => $newData];
}

// POST /admin/releases – создание релиза
if ($method === 'POST' && !$id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для создания', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $pdo->beginTransaction();
    try {
        // Поля релиза
        $stmt = $pdo->prepare("INSERT INTO releases (
                title, slug, subtitle, description, release_year, premiere_date, type, theme, sort_order, is_published, is_premiere
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['title'],
            $data['slug'],
            $data['subtitle'] ?? null,
            $data['description'] ?? null,
            $data['release_year'] ?? null,
            $data['premiere_date'] ?? null,
            $data['type'] ?? 'album',
            $data['theme'] ?? 'default',
            $data['sort_order'] ?? 0,
            $data['is_published'] ?? 0,
            $data['is_premiere'] ?? 0
        ]);
        $newId = $pdo->lastInsertId();

        // Сброс других премьер
        if ($data['is_premiere']) {
            $stmtReset = $pdo->prepare("UPDATE releases SET is_premiere = 0 WHERE id != ?");
            $stmtReset->execute([$newId]);
        }

        // Теги (если переданы)
        if (isset($data['genre_ids']) && is_array($data['genre_ids'])) {
            $stmtIns = $pdo->prepare("INSERT INTO release_genre (release_id, genre_id) VALUES (?, ?)");
            foreach ($data['genre_ids'] as $gid) {
                $stmtIns->execute([$newId, $gid]);
            }
        }

        // Треки (если переданы)
        if (isset($data['tracks']) && is_array($data['tracks']) && !empty($data['tracks'])) {
            $trackIds = array_column($data['tracks'], 'track_id');
            $placeholders = implode(',', array_fill(0, count($trackIds), '?'));
            $stmtCheck = $pdo->prepare("SELECT id FROM tracks WHERE id IN ($placeholders)");
            $stmtCheck->execute($trackIds);
            if (count($stmtCheck->fetchAll(PDO::FETCH_COLUMN)) !== count($trackIds)) {
                throw new Exception('Некоторые треки не найдены');
            }
            $stmtInsTrack = $pdo->prepare("INSERT INTO release_tracks (release_id, track_id, track_number) VALUES (?, ?, ?)");
            foreach ($data['tracks'] as $t) {
                $stmtInsTrack->execute([$newId, $t['track_id'], $t['track_number']]);
            }
        }

        $pdo->commit();
        jsonResponseWithWarnings(['id' => $newId, 'warnings' => $result['warnings'], 'newData' => $result['newData']], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError($e->getMessage(), 400);
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->errorInfo[1] == 1062) {
            jsonError('Релиз с таким кодом уже существует', 409);
        }
        throw $e;
    }
}

// PUT /admin/releases?id={id} – обновление релиза
if ($method === 'PUT' && $id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для обновления', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $stmtCheck = $pdo->prepare("SELECT id FROM releases WHERE id = ?");
    $stmtCheck->execute([$id]);
    if (!$stmtCheck->fetch(PDO::FETCH_ASSOC)) {
        jsonError('Релиз не найден', 404);
    }

    $allowedFields = ['title', 'slug', 'subtitle', 'description', 'release_year',
        'premiere_date', 'type', 'theme', 'sort_order', 'is_published', 'is_premiere'];
    $fields = [];
    $params = [];
    foreach ($allowedFields as $f) {
        if (array_key_exists($f, $data)) {
            $fields[] = "$f = ?";
            $params[] = $data[$f];
        }
    }

    $pdo->beginTransaction();
    try {
        if (!empty($fields)) {
            $params[] = $id;
            $sql = "UPDATE releases SET " . implode(', ', $fields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        // Сброс других премьер
        if (isset($data['is_premiere']) && $data['is_premiere']) {
            $stmtReset = $pdo->prepare("UPDATE releases SET is_premiere = 0 WHERE id != ?");
            $stmtReset->execute([$id]);
        }

        // Жанры
        if (isset($data['genre_ids'])) {
            $stmtDel = $pdo->prepare("DELETE FROM release_genre WHERE release_id = ?");
            $stmtDel->execute([$id]);
            if (!empty($data['genre_ids'])) {
                $stmtIns = $pdo->prepare("INSERT INTO release_genre (release_id, genre_id) VALUES (?, ?)");
                foreach ($data['genre_ids'] as $gid) {
                    $stmtIns->execute([$id, $gid]);
                }
            }
        }

        // Треки
        if (isset($data['tracks'])) {
            $stmtDelTracks = $pdo->prepare("DELETE FROM release_tracks WHERE release_id = ?");
            $stmtDelTracks->execute([$id]);
            if (!empty($data['tracks'])) {
                $trackIds = array_column($data['tracks'], 'track_id');
                $placeholders = implode(',', array_fill(0, count($trackIds), '?'));
                $stmtCheck = $pdo->prepare("SELECT id FROM tracks WHERE id IN ($placeholders)");
                $stmtCheck->execute($trackIds);
                if (count($stmtCheck->fetchAll(PDO::FETCH_COLUMN)) !== count($trackIds)) {
                    throw new Exception('Некоторые треки не найдены');
                }
                $stmtInsTrack = $pdo->prepare("INSERT INTO release_tracks (release_id, track_id, track_number) VALUES (?, ?, ?)");
                foreach ($data['tracks'] as $t) {
                    $stmtInsTrack->execute([$id, $t['track_id'], $t['track_number']]);
                }
            }
        }

        $pdo->commit();
        jsonResponse(['success' => true, 'warnings' => $result['warnings'], 'newData' => $result['newData']]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError($e->getMessage(), 400);
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->errorInfo[1] == 1062) {
            jsonError('Релиз с таким кодом уже существует', 409);
        }
        throw $e;
    }
}

// DELETE /admin/releases?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT uuid FROM releases WHERE id = ?");
    $stmt->execute([$id]);
    $release = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$release)
        jsonError('Релиз не найден', 404);

    $stmt = $pdo->prepare("DELETE FROM releases WHERE id = ?");
    $stmt->execute([$id]);

    $releaseDir = UPLOAD_DIR . 'release/' . $release['uuid'];
    if (is_dir($releaseDir)) {
        $files = glob("$releaseDir/*");
        if ($files) {
            foreach ($files as $file) {
                if (is_file($file))
                    unlink($file);
            }
        }
        rmdir($releaseDir);
    }
    jsonResponse(['success' => true]);
}

jsonError('Обработчик не найден', 404);
