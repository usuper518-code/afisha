<?php

$pdo = getDB();

// GET /admin/tracks – список с фильтрацией, сортировкой и выбором полей
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

    $search = $_GET['search'] ?? null;
    $releaseId = $_GET['release_id'] ?? null;
    $genreIds = $_GET['genre_ids'] ?? null;
    $isPublished = $_GET['is_published'] ?? null;
    $fieldsParam = $_GET['fields'] ?? '';
    $excludeIds = $_GET['exclude_ids'] ?? null;

    // Белые списки
    $allowedFields = ['id', 'title', 'slug', 'authors', 'lyrics', 'suggested_emotions',
        'is_instrumental', 'lyrics_timed', 'duration', 'original_track_id', 'is_published',
        'created_at', 'updated_at', 'uuid'];
    $allowedOrder = ['id', 'title', 'duration', 'created_at', 'updated_at'];

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
    $sql = "SELECT " . implode(', ', $selectFields) . " FROM tracks";
    $params = [];
    $whereConditions = [];

    if ($excludeIds) {
        $ids = array_map('intval', explode(',', $excludeIds));
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $whereConditions[] = "id NOT IN ($placeholders)";
        $params = array_merge($params, $ids);
    }

    // Фильтр по релизу
    if ($releaseId) {
        $whereConditions[] = "EXISTS (SELECT 1 FROM release_tracks WHERE track_id = tracks.id AND release_id = ?)";
        $params[] = $releaseId;
    }

    // Фильтр по жанрам
    if ($genreIds) {
        $genreIdArray = array_map('intval', explode(',', $genreIds));
        if (!empty($genreIdArray)) {
            $placeholders = implode(',', array_fill(0, count($genreIdArray), '?'));
            $whereConditions[] = "EXISTS (SELECT 1 FROM track_genre WHERE track_id = tracks.id AND genre_id IN ($placeholders))";
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
    $tracks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Общее количество
    $countSql = "SELECT COUNT(*) FROM tracks";
    if (!empty($whereConditions)) {
        $countSql .= " WHERE " . implode(' AND ', $whereConditions);
    }
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $tracks, 'total' => (int) $total]);
}

// GET /admin/tracks?id={id}
if ($method === 'GET' && $id) {
    $stmt = $pdo->prepare("SELECT * FROM tracks WHERE id = ?");
    $stmt->execute([$id]);
    $track = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$track) {
        jsonError('Трек не найден', 404);
    }

    // Пути к файлам
    $track['cover_url'] = get_cover_url($track['uuid'], 'track');
    $track['audio_url'] = get_audio_url($track['uuid']);

    // Жанры
    $stmtG = $pdo->prepare("SELECT g.id, g.name FROM genres g JOIN track_genre tg ON g.id = tg.genre_id WHERE tg.track_id = ?");
    $stmtG->execute([$id]);
    $track['genres'] = $stmtG->fetchAll(PDO::FETCH_ASSOC);

    // Артисты
    $stmtA = $pdo->prepare("SELECT a.id, a.name, a.voice_type FROM artists a JOIN track_artists ta ON a.id = ta.artist_id WHERE ta.track_id = ? ORDER BY a.name");
    $stmtA->execute([$id]);
    $track['artists'] = $stmtA->fetchAll(PDO::FETCH_ASSOC);

    // Релизы, в которые входит трек
    $stmtR = $pdo->prepare("SELECT r.id, r.title FROM release_tracks rt JOIN releases r ON rt.release_id = r.id WHERE rt.track_id = ? ORDER BY r.title");
    $stmtR->execute([$id]);
    $track['releases'] = $stmtR->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse($track);
}

function chkData($data, $method) {
    $errors = [];
    $warnings = [];
    $newData = [];

    //Название
    if (isset($data['title'])) {
        $data['title'] = trim($data['title']);
        if ($data['title'] === '') {
            $errors[] = ['field' => 'title', 'message' => 'Название не может быть пустым'];
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

    //Авторы
    if (isset($data['authors'])) {
        $data['authors'] = trim($data['authors']);
        if ($data['authors'] === '' && $method === 'POST') {
            $data['authors'] = afisha_setting('default_author');
            $newData['authors'] = $data['authors'];
        }
        $maxLen = 500;
        if (mb_strlen($data['authors'] ?? '') > $maxLen) {
            $warnings[] = ['field' => 'authors', 'message' => 'Поле автор обрезано до ' . $maxLen . ' символов'];
            $data['authors'] = mb_substr($data['authors'], 0, $maxLen);
            $newData['authors'] = $data['authors'];
        }
    }

    // Инструментал
    $isInstrumental = isset($data['is_instrumental']) ? (int) (bool) $data['is_instrumental'] : 0;
    if (isset($data['is_instrumental'])) {
        $data['is_instrumental'] = $isInstrumental;
    }

    // Текст
    if (isset($data['lyrics'])) {
        $data['lyrics'] = trim($data['lyrics']);
        if (!$isInstrumental && !$data['lyrics']) {
            $errors[] = ['field' => 'lyrics', 'message' => 'Требуется текст (или отметьте как инструментальный)'];
        }
    } elseif (!$isInstrumental && $method === 'POST') {
        $errors[] = ['field' => 'lyrics', 'message' => 'Требуется текст (или отметьте как инструментальный)'];
    }

    // Длительность
    if (isset($data['duration'])) {
        $data['duration'] = (int) $data['duration'];
        if ($data['duration'] < 0) {
            $errors[] = ['field' => 'duration', 'message' => 'Длительность не может быть отрицательной'];
        }
    }

    // Оригинальный трек
    if (isset($data['original_track_id'])) {
        $data['original_track_id'] = ($data['original_track_id'] === '') ? null : (int) $data['original_track_id'];
    }

    // Опубликован
    if (isset($data['is_published'])) {
        $data['is_published'] = (int) (bool) $data['is_published'];
    }

    // suggested_emotions
    if (isset($data['suggested_emotions'])) {
        $data['suggested_emotions'] = trim($data['suggested_emotions']);
        $maxLen = 7;
        if (mb_strlen($data['suggested_emotions']) > $maxLen) {
            $warnings[] = ['field' => 'suggested_emotions', 'message' => 'Поле эмоций обрезано до ' . $maxLen . ' символов'];
            $data['suggested_emotions'] = mb_substr($data['suggested_emotions'], 0, $maxLen);
            $newData['suggested_emotions'] = $data['suggested_emotions'];
        }
    }

    // lyrics_timed
    if (isset($data['lyrics_timed'])) {
        $data['lyrics_timed'] = trim($data['lyrics_timed']);
    }

    if (!empty($errors)) {
        jsonErrorExtend($errors, $warnings, 422);
    }
    return ['data' => $data, 'warnings' => $warnings, 'newData' => $newData];
}

// POST /admin/tracks – создание трека
if ($method === 'POST' && !$id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для создания', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO tracks (
                title, slug, authors, lyrics, suggested_emotions, is_instrumental, lyrics_timed,
                duration, original_track_id, is_published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['title'],
            $data['slug'],
            $data['authors'] ?? afisha_setting('default_author'),
            $data['lyrics'] ?? '',
            $data['suggested_emotions'] ?? '',
            $data['is_instrumental'] ?? 0,
            $data['lyrics_timed'] ?? null,
            $data['duration'] ?? 0,
            $data['original_track_id'] ?? null,
            $data['is_published'] ?? 0
        ]);
        $newId = $pdo->lastInsertId();

        // Жанры
        if (isset($data['genre_ids']) && is_array($data['genre_ids'])) {
            $stmtIns = $pdo->prepare("INSERT INTO track_genre (track_id, genre_id) VALUES (?, ?)");
            foreach ($data['genre_ids'] as $gid) {
                $stmtIns->execute([$newId, $gid]);
            }
        }

        // Артисты
        if (isset($data['artist_ids']) && is_array($data['artist_ids'])) {
            $stmtIns = $pdo->prepare("INSERT INTO track_artists (track_id, artist_id) VALUES (?, ?)");
            foreach ($data['artist_ids'] as $aid) {
                $stmtIns->execute([$newId, $aid]);
            }
        }

        $pdo->commit();
        jsonResponseWithWarnings(['id' => $newId, 'warnings' => $result['warnings'], 'newData' => $result['newData']], 201);
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->errorInfo[1] == 1062) {
            jsonError('Трек с таким кодом уже существует', 409);
        }
        throw $e;
    }
}

// PUT /admin/tracks?id={id} – обновление трека
if ($method === 'PUT' && $id) {
    $raw = getRequestBody();
    if (empty($raw)) {
        jsonError('Нет данных для обновления', 400);
    }
    $result = chkData($raw, $method);
    $data = $result['data'];

    $stmtCheck = $pdo->prepare("SELECT id FROM tracks WHERE id = ?");
    $stmtCheck->execute([$id]);
    if (!$stmtCheck->fetch(PDO::FETCH_ASSOC)) {
        jsonError('Трек не найден', 404);
    }

    // Поля трека
    $allowedFields = ['title', 'slug', 'authors', 'lyrics', 'suggested_emotions',
        'is_instrumental', 'lyrics_timed', 'duration', 'original_track_id', 'is_published'];
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
            $sql = "UPDATE tracks SET " . implode(', ', $fields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        // Жанры
        if (isset($data['genre_ids'])) {
            $stmtDel = $pdo->prepare("DELETE FROM track_genre WHERE track_id = ?");
            $stmtDel->execute([$id]);
            if (!empty($data['genre_ids'])) {
                $stmtIns = $pdo->prepare("INSERT INTO track_genre (track_id, genre_id) VALUES (?, ?)");
                foreach ($data['genre_ids'] as $gid) {
                    $stmtIns->execute([$id, $gid]);
                }
            }
        }

        // Артисты
        if (isset($data['artist_ids'])) {
            $stmtDel = $pdo->prepare("DELETE FROM track_artists WHERE track_id = ?");
            $stmtDel->execute([$id]);
            if (!empty($data['artist_ids'])) {
                $stmtIns = $pdo->prepare("INSERT INTO track_artists (track_id, artist_id) VALUES (?, ?)");
                foreach ($data['artist_ids'] as $aid) {
                    $stmtIns->execute([$id, $aid]);
                }
            }
        }

        $pdo->commit();
        jsonResponse(['success' => true, 'warnings' => $result['warnings'], 'newData' => $result['newData']]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->errorInfo[1] == 1062) {
            jsonError('Трек с таким кодом уже существует', 409);
        }
        throw $e;
    }
}

// DELETE /admin/tracks?id={id}
if ($method === 'DELETE' && $id) {
    $stmt = $pdo->prepare("SELECT uuid FROM tracks WHERE id = ?");
    $stmt->execute([$id]);
    $track = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$track) {
        jsonError('Трек не найден', 404);
    }

    $stmt = $pdo->prepare("DELETE FROM tracks WHERE id = ?");
    $stmt->execute([$id]);

    // Удаляем папку с файлами трека
    $trackDir = UPLOAD_DIR . 'track/' . $track['uuid'];
    if (is_dir($trackDir)) {
        $files = glob("$trackDir/*");
        if ($files) {
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
        }
        rmdir($trackDir);
    }

    jsonResponse(['success' => true]);
}

jsonError('Обработчик не найден', 404);
