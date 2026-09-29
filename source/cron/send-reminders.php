<?php
/**
 * Рассылка напоминаний о премьере.
 *
 * Запуск из cron, раз в сутки (время — местное для сервера):
 *   0 10 * * * php /path/to/source/cron/send-reminders.php
 *
 * Письмо уходит, если до премьеры осталось не больше суток
 * (сегодня или завтра) и оно ещё не отправлялось.
 * Подписчикам (users.is_subscribed) строки очереди добавляются здесь же.
 * Точечная запись «напомнить об этой премьере» создаётся API /api/remind.
 *
 * Адрес отправителя — MAIL_FROM в api/config.php. Пока он пустой,
 * письма не помечаются отправленными и остаются в очереди.
 *
 *   php send-reminders.php --dry-run
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
$pdo->exec("INSERT IGNORE INTO premiere_reminders (user_id, release_id)
    SELECT u.id, r.id
    FROM users u
    JOIN releases r
      ON r.is_published = 1
     AND r.premiere_date IS NOT NULL
     AND r.premiere_date >= CURDATE()
     AND r.premiere_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    WHERE u.is_subscribed = 1
      AND u.email IS NOT NULL
      AND u.email <> ''");

$stmt = $pdo->query("SELECT pr.id AS reminder_id, u.email, u.nickname, r.title, r.slug, r.premiere_date
    FROM premiere_reminders pr
    JOIN users u ON u.id = pr.user_id
    JOIN releases r ON r.id = pr.release_id
    WHERE pr.sent_at IS NULL
      AND r.is_published = 1
      AND r.premiere_date IS NOT NULL
      AND r.premiere_date >= CURDATE()
      AND r.premiere_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      AND u.email IS NOT NULL
      AND u.email <> ''
    ORDER BY r.premiere_date, pr.id");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    fwrite(STDERR, "Если таблицы ещё нет: source/sql/migrations/001_premiere_reminders.sql\n");
    exit(1);
}

$logDir = ROOT_DIR . '/logs';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
$logFile = $logDir . '/reminders.log';

$from = defined('MAIL_FROM') ? trim(MAIL_FROM) : '';
if ($from === '' && !$dryRun) {
    $message = date('c') . " MAIL_FROM пуст, отправка пропущена, в очереди " . count($rows) . "\n";
    file_put_contents($logFile, $message, FILE_APPEND);
    fwrite(STDOUT, $message);
    exit(0);
}

$mark = $pdo->prepare("UPDATE premiere_reminders SET sent_at = NOW() WHERE id = ? AND sent_at IS NULL");
$sent = 0;
$failed = 0;

foreach ($rows as $row) {
    $when = $row['premiere_date'] === date('Y-m-d') ? 'сегодня' : 'завтра';
    $name = $row['nickname'] ?: 'друг театра';
    $url = rtrim(BASE_URL, '/') . '/albums/' . $row['slug'] . '/';
    $subject = 'Премьера «' . $row['title'] . '» — ' . $when;
    $body = "Здравствуйте, {$name}!\n\n"
        . "Напоминаем: премьера «{$row['title']}» {$when}, {$row['premiere_date']}.\n"
        . "Страница спектакля: {$url}\n\n"
        . "С уважением, " . SITE_TITLE . "\n";

    $line = date('c') . " {$row['email']} | {$row['title']} | {$row['premiere_date']}";

    if ($dryRun) {
        fwrite(STDOUT, "[dry-run] {$line}\n");
        continue;
    }

    $headers = "From: " . $from . "\r\n"
        . "Reply-To: " . $from . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n";
    $encodedSubject = mb_encode_mimeheader($subject, 'UTF-8');
    $ok = mail($row['email'], $encodedSubject, $body, $headers);
    if ($ok) {
        $mark->execute([$row['reminder_id']]);
        $sent++;
        file_put_contents($logFile, $line . " sent\n", FILE_APPEND);
    } else {
        $failed++;
        file_put_contents($logFile, $line . " FAILED\n", FILE_APPEND);
        fwrite(STDERR, "Не отправлено: {$line}\n");
    }
}

fwrite(STDOUT, "Отправлено: {$sent}, ошибок: {$failed}, в выборке: " . count($rows) . "\n");
exit($failed > 0 ? 1 : 0);
