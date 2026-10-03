<?php
/**
 * Рассылка именных буклетов.
 *
 * Раз в час:
 *   0 * * * * php /path/to/source/cron/send-booklets.php
 *
 * Берёт отзывы с галочкой «хочу буклет», которые ещё не отправлялись.
 * Дата премьеры не важна: письмо уходит и после спектакля.
 * PDF собирается во временный файл вне сайта, вкладывается в письмо и удаляется.
 * Пока MAIL_FROM пустой, строки не помечаются отправленными.
 *
 *   php send-booklets.php --dry-run
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Скрипт запускается только из командной строки\n");
    exit(1);
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/functions.php';

$dryRun = in_array('--dry-run', $argv, true);
$pdo = getDB();

try {
    $stmt = $pdo->query("SELECT r.id AS review_id, u.email, u.nickname, u.is_subscribed,
            rel.id AS release_id, rel.title
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        JOIN releases rel ON rel.id = r.release_id
        WHERE r.want_booklet = 1
          AND r.booklet_sent_at IS NULL
          AND rel.is_published = 1
          AND u.email IS NOT NULL
          AND u.email <> ''
        ORDER BY r.id");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    fwrite(STDERR, "Если колонки ещё нет: source/sql/migrations/002_review_booklet_sent.sql\n");
    exit(1);
}

$logDir = ROOT_DIR . '/logs';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
$logFile = $logDir . '/booklets.log';

$from = defined('MAIL_FROM') ? trim(MAIL_FROM) : '';
if ($from === '' && !$dryRun) {
    $message = date('c') . " MAIL_FROM пуст, отправка буклетов пропущена, в очереди " . count($rows) . "\n";
    file_put_contents($logFile, $message, FILE_APPEND);
    fwrite(STDOUT, $message);
    exit(0);
}

$queue = [];
foreach ($rows as $row) {
    if (!isSafeEmail((string) $row['email'])) {
        continue;
    }
    $queue[] = $row;
}

$mark = $pdo->prepare("UPDATE reviews SET booklet_sent_at = NOW() WHERE id = ? AND booklet_sent_at IS NULL");
$sent = 0;
$failed = 0;
$tmpDir = ROOT_DIR . '/storage/booklets';

foreach ($queue as $row) {
    $name = str_replace(["\r", "\n"], ' ', trim((string) $row['nickname']));
    if ($name === '') {
        $name = 'друг театра';
    }
    $title = str_replace(["\r", "\n"], ' ', trim((string) $row['title']));
    $line = date('c') . " {$row['email']} | {$title}";

    if ($dryRun) {
        fwrite(STDOUT, "[dry-run] {$line}\n");
        continue;
    }

    $tmp = $tmpDir . '/' . (int) $row['review_id'] . '.pdf';
    $ok = false;
    try {
        $data = loadBookletAlbum($pdo, (int) $row['release_id']);
        if (!$data) {
            throw new RuntimeException('спектакль не найден');
        }
        generateBooklet((int) $row['release_id'], $data, ['nickname' => $name], $tmp);
        if (!is_file($tmp)) {
            throw new RuntimeException('буклет не собран');
        }
        $ok = sendBookletMail($row['email'], $from, $name, $title, !empty($row['is_subscribed']), $tmp);
    } catch (Throwable $e) {
        $ok = false;
        fwrite(STDERR, $e->getMessage() . "\n");
    } finally {
        if (is_file($tmp)) {
            unlink($tmp);
        }
    }

    if ($ok) {
        $mark->execute([(int) $row['review_id']]);
        $sent++;
        file_put_contents($logFile, $line . " sent\n", FILE_APPEND);
    } else {
        $failed++;
        file_put_contents($logFile, $line . " FAILED\n", FILE_APPEND);
        fwrite(STDERR, "Не отправлено: {$line}\n");
    }
}

fwrite(STDOUT, "Отправлено: {$sent}, ошибок: {$failed}, в выборке: " . count($queue) . "\n");
exit($failed > 0 ? 1 : 0);

function loadBookletAlbum(PDO $pdo, int $albumId): ?array {
    $stmt = $pdo->prepare("SELECT * FROM releases WHERE id = ?");
    $stmt->execute([$albumId]);
    $album = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$album) {
        return null;
    }
    $stmtT = $pdo->prepare("SELECT t.*, rt.track_number
        FROM release_tracks rt
        JOIN tracks t ON rt.track_id = t.id
        WHERE rt.release_id = ?
        ORDER BY rt.track_number");
    $stmtT->execute([$albumId]);
    $tracks = $stmtT->fetchAll(PDO::FETCH_ASSOC);
    $stmtA = $pdo->prepare("SELECT a.name FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = ?");
    foreach ($tracks as &$track) {
        $stmtA->execute([$track['id']]);
        $track['artists'] = $stmtA->fetchAll(PDO::FETCH_COLUMN);
    }
    unset($track);
    return ['album' => $album, 'tracks' => $tracks];
}

function sendBookletMail(string $to, string $from, string $name, string $title, bool $subscribed, string $pdfPath): bool {
    $subject = mb_encode_mimeheader('Буклет спектакля «' . $title . '»', 'UTF-8');
    $text = "Здравствуйте, {$name}!\n\n"
        . "Спасибо за ваш отзыв о спектакле «{$title}».\n"
        . "Буклет — во вложении.\n\n";
    if ($subscribed) {
        $text .= "Вы подписаны на рассылку анонсов. Будем сообщать о новых премьерах!\n";
    }
    $text .= "С уважением, " . afisha_setting('site_title') . "\n";

    $boundary = 'bk_' . bin2hex(random_bytes(8));
    $headers = "From: {$from}\r\n"
        . "Reply-To: {$from}\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";
    $pdf = chunk_split(base64_encode((string) file_get_contents($pdfPath)));
    $body = "--{$boundary}\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $text . "\r\n"
        . "--{$boundary}\r\n"
        . "Content-Type: application/pdf; name=\"booklet.pdf\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"booklet.pdf\"\r\n\r\n"
        . $pdf
        . "--{$boundary}--\r\n";
    return mail($to, $subject, $body, $headers);
}
