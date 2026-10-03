-- Финальная база «Студия».
-- Создаёт базу catalog, если её нет, сносит таблицы и заливает программу:
-- три вечера Queen и два вечера «Ковры квадратные».
-- Отзывы зрителей, напоминания и тестовые карточки при этом пропадают.
--
-- Запуск из корня репозитория:
--   mysql -uroot -p --default-character-set=utf8mb4 < source/sql/final.sql
--
-- Схема ниже совпадает с source/sql/catalog.sql.
-- Текстов песен Queen и коммерческих записей здесь нет.
-- Обложки и страницы этот файл не создаёт: их рисует source/sql/seed-realistic.py.

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `catalog` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `catalog`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS
  `premiere_reminders`,
  `events`,
  `reactions`,
  `ratings`,
  `reviews`,
  `release_genre`,
  `release_tracks`,
  `track_artists`,
  `track_genre`,
  `tracks`,
  `releases`,
  `artists`,
  `news`,
  `genres`,
  `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Хост: 127.0.0.1
-- Время создания: Авг 30 2026 г., 21:49
-- Версия сервера: 10.4.32-MariaDB
-- Версия PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `catalog`
--

-- --------------------------------------------------------

--
-- Структура таблицы `artists`
--

CREATE TABLE `artists` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'Имя артиста',
  `slug` varchar(255) NOT NULL COMMENT 'ЧПУ для URL',
  `voice_type` varchar(255) DEFAULT NULL COMMENT 'soprano,mezzo,contralto,tenor,baritone,bass,instrumental,choir',
  `description` text DEFAULT NULL COMMENT 'Описание',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Активен',
  `sort_order` int(11) DEFAULT 0 COMMENT 'Порядок отображения',
  `uuid` varchar(36) NOT NULL DEFAULT uuid(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'ссылка на users.id',
  `event_type` enum('play','rating','review','reaction_add','reaction_remove','share') NOT NULL,
  `entity_type` enum('release','track') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `genres`
--

CREATE TABLE `genres` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Название жанра',
  `slug` varchar(100) NOT NULL COMMENT 'ЧПУ для фильтрации'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `news`
--

CREATE TABLE `news` (
  `id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL COMMENT 'Заголовок новости',
  `content` text NOT NULL COMMENT 'Текст новости',
  `is_published` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `ratings`
--

CREATE TABLE `ratings` (
  `id` int(11) NOT NULL,
  `release_id` int(11) NOT NULL COMMENT 'ссылка на release.id',
  `user_id` int(11) NOT NULL COMMENT 'ссылка на users.id',
  `rating` tinyint(4) NOT NULL COMMENT 'Рейтинг',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `reactions`
--

CREATE TABLE `reactions` (
  `id` int(11) NOT NULL,
  `release_id` int(11) NOT NULL COMMENT 'ссылка на release.id',
  `track_id` int(11) DEFAULT NULL COMMENT 'ссылка на release.id',
  `user_id` int(11) NOT NULL COMMENT 'ссылка на users.id',
  `emotion_A` tinyint(1) DEFAULT 0 COMMENT 'эмоция А',
  `emotion_B` tinyint(1) DEFAULT 0 COMMENT 'эмоция B',
  `emotion_C` tinyint(1) DEFAULT 0 COMMENT 'эмоция C',
  `emotion_D` tinyint(1) DEFAULT 0 COMMENT 'эмоция D',
  `emotion_E` tinyint(1) DEFAULT 0 COMMENT 'эмоция E',
  `emotion_F` tinyint(1) DEFAULT 0 COMMENT 'эмоция F',
  `emotion_G` tinyint(1) DEFAULT 0 COMMENT 'эмоция G',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `releases`
--

CREATE TABLE `releases` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL COMMENT 'Название',
  `slug` varchar(255) NOT NULL COMMENT 'ЧПУ для URL',
  `subtitle` varchar(255) DEFAULT NULL COMMENT 'Подзаголовок',
  `description` text DEFAULT NULL COMMENT 'Краткое описание',
  `release_year` year(4) DEFAULT NULL COMMENT 'Год выпуска',
  `premiere_date` date DEFAULT NULL COMMENT 'Дата премьеры',
  `type` enum('album','single','ep','compilation','remix','demo','rock_opera','musical') DEFAULT 'album',
  `sort_order` int(11) DEFAULT 0 COMMENT 'Порядок отображения',
  `is_published` tinyint(1) DEFAULT 1 COMMENT 'Опубликован ли',
  `is_premiere` tinyint(1) DEFAULT 0 COMMENT 'Текущая премьера',
  `theme` varchar(50) DEFAULT 'default' COMMENT 'Тема оформления',
  `uuid` varchar(36) NOT NULL DEFAULT uuid(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `release_genre`
--

CREATE TABLE `release_genre` (
  `release_id` int(11) NOT NULL,
  `genre_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `release_tracks`
--

CREATE TABLE `release_tracks` (
  `release_id` int(11) NOT NULL,
  `track_id` int(11) NOT NULL,
  `track_number` int(11) NOT NULL COMMENT 'Порядковый номер в данном релизе'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `reviews`
--

CREATE TABLE `reviews` (
  `id` int(11) NOT NULL,
  `release_id` int(11) NOT NULL COMMENT 'ссылка на release.id',
  `user_id` int(11) NOT NULL COMMENT 'ссылка на users.id',
  `content` text NOT NULL COMMENT 'отзыв',
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `want_booklet` tinyint(1) DEFAULT 0 COMMENT 'хочет буклет',
  `booklet_sent_at` timestamp NULL DEFAULT NULL COMMENT 'когда именной буклет ушёл на почту',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `tracks`
--

CREATE TABLE `tracks` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL COMMENT 'Название',
  `slug` varchar(255) NOT NULL COMMENT 'ЧПУ для URL',
  `authors` varchar(500) DEFAULT 'Неизвестный' COMMENT 'Авторы текста',
  `lyrics` longtext NOT NULL COMMENT 'Текст трека',
  `lyrics_timed` longtext DEFAULT NULL COMMENT 'Таймкоды для подсветки (JSON)',
  `suggested_emotions` varchar(7) DEFAULT '' COMMENT 'Рекомендованные эмоции',
  `is_instrumental` tinyint(1) DEFAULT 0 COMMENT 'Инструментальный трек (без текста)',
  `duration` int(11) DEFAULT 0 COMMENT 'Длительность в секундах',
  `original_track_id` int(11) DEFAULT NULL COMMENT 'Ссылка на оригинал (для каверов/ремиксов)',
  `is_published` tinyint(1) DEFAULT 1,
  `uuid` varchar(36) NOT NULL DEFAULT uuid(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `track_artists`
--

CREATE TABLE `track_artists` (
  `track_id` int(11) NOT NULL,
  `artist_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `track_genre`
--

CREATE TABLE `track_genre` (
  `track_id` int(11) NOT NULL,
  `genre_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `nickname` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `is_subscribed` tinyint(1) DEFAULT 0 COMMENT 'Подписан на рассылку (буклеты, анонсы)',
  `avatar_url` varchar(255) DEFAULT NULL,
  `level` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `artists`
--
ALTER TABLE `artists`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `uuid` (`uuid`);

--
-- Индексы таблицы `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_type` (`event_type`),
  ADD KEY `idx_created` (`created_at`);

--
-- Индексы таблицы `genres`
--
ALTER TABLE `genres`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Индексы таблицы `news`
--
ALTER TABLE `news`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_release_rating` (`release_id`,`user_id`),
  ADD KEY `rating_ibfk_1` (`user_id`);

--
-- Индексы таблицы `reactions`
--
ALTER TABLE `reactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_track_reaction` (`release_id`,`track_id`,`user_id`),
  ADD KEY `reactions_ibfk_1` (`user_id`),
  ADD KEY `reactions_ibfk_3` (`track_id`);

--
-- Индексы таблицы `releases`
--
ALTER TABLE `releases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `uuid` (`uuid`);

--
-- Индексы таблицы `release_genre`
--
ALTER TABLE `release_genre`
  ADD PRIMARY KEY (`release_id`,`genre_id`),
  ADD KEY `release_genre_ibfk_2` (`genre_id`);

--
-- Индексы таблицы `release_tracks`
--
ALTER TABLE `release_tracks`
  ADD PRIMARY KEY (`release_id`,`track_id`),
  ADD KEY `release_tracks_ibfk_2` (`track_id`);

--
-- Индексы таблицы `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_release_review` (`release_id`,`user_id`),
  ADD KEY `reviews_ibfk_1` (`user_id`);

--
-- Индексы таблицы `tracks`
--
ALTER TABLE `tracks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD KEY `tracks_ibfk_1` (`original_track_id`);

--
-- Индексы таблицы `track_artists`
--
ALTER TABLE `track_artists`
  ADD PRIMARY KEY (`track_id`,`artist_id`),
  ADD KEY `track_artists_ibfk_2` (`artist_id`);

--
-- Индексы таблицы `track_genre`
--
ALTER TABLE `track_genre`
  ADD PRIMARY KEY (`track_id`,`genre_id`),
  ADD KEY `track_genre_ibfk_2` (`genre_id`);

--
-- Индексы таблицы `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `client_id` (`client_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `artists`
--
ALTER TABLE `artists`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `genres`
--
ALTER TABLE `genres`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `news`
--
ALTER TABLE `news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `ratings`
--
ALTER TABLE `ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `reactions`
--
ALTER TABLE `reactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `releases`
--
ALTER TABLE `releases`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `tracks`
--
ALTER TABLE `tracks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Ограничения внешнего ключа сохраненных таблиц
--

--
-- Ограничения внешнего ключа таблицы `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `ratings`
--
ALTER TABLE `ratings`
  ADD CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ratings_ibfk_2` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `reactions`
--
ALTER TABLE `reactions`
  ADD CONSTRAINT `reactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reactions_ibfk_2` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reactions_ibfk_3` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `release_genre`
--
ALTER TABLE `release_genre`
  ADD CONSTRAINT `release_genre_ibfk_1` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `release_genre_ibfk_2` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `release_tracks`
--
ALTER TABLE `release_tracks`
  ADD CONSTRAINT `release_tracks_ibfk_1` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `release_tracks_ibfk_2` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `tracks`
--
ALTER TABLE `tracks`
  ADD CONSTRAINT `tracks_ibfk_1` FOREIGN KEY (`original_track_id`) REFERENCES `tracks` (`id`) ON DELETE SET NULL;

--
-- Ограничения внешнего ключа таблицы `track_artists`
--
ALTER TABLE `track_artists`
  ADD CONSTRAINT `track_artists_ibfk_1` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `track_artists_ibfk_2` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `track_genre`
--
ALTER TABLE `track_genre`
  ADD CONSTRAINT `track_genre_ibfk_1` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `track_genre_ibfk_2` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`id`) ON DELETE CASCADE;

--
-- Очередь напоминаний о премьере
--
CREATE TABLE `premiere_reminders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `release_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `sent_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `premiere_reminders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_release` (`user_id`, `release_id`),
  ADD KEY `idx_unsent` (`sent_at`, `release_id`);

ALTER TABLE `premiere_reminders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `premiere_reminders`
  ADD CONSTRAINT `premiere_reminders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `premiere_reminders_release` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO `genres` (`name`, `slug`) VALUES
  ('Рок', 'rok'),
  ('Авторская', 'bard');

INSERT INTO `artists` (`name`, `slug`, `voice_type`, `description`, `is_active`, `sort_order`, `uuid`) VALUES
  ('Фредди Меркьюри', 'freddie-mercury', 'тенор', 'Голос рампы Queen.', 1, 1, 'a1111111-1111-4111-8111-000000000001'),
  ('Брайан Мэй', 'brian-may', 'гитара', 'Красная гитара, длинные фразы.', 1, 2, 'a1111111-1111-4111-8111-000000000002'),
  ('Роджер Тейлор', 'roger-taylor', 'ударные', 'Топот и высокий подголосок.', 1, 3, 'a1111111-1111-4111-8111-000000000003'),
  ('Джон Дикон', 'john-deacon', 'бас', 'Держит низ, почти не выходит к рампе.', 1, 4, 'a1111111-1111-4111-8111-000000000004'),
  ('Нина Кромка', 'nina-kromka', 'сопрано', 'Ковры квадратные. Поёт кромку и углы.', 1, 5, 'a1111111-1111-4111-8111-000000000005'),
  ('Лев Уток', 'lev-utok', 'баритон', 'Ковры квадратные. Говорит, будто стелет.', 1, 6, 'a1111111-1111-4111-8111-000000000006'),
  ('Марк Паркет', 'mark-parket', 'инструментал', 'Ковры квадратные. Пол, метроном, тишина.', 1, 7, 'a1111111-1111-4111-8111-000000000007');

INSERT INTO `releases` (`title`, `slug`, `subtitle`, `description`, `release_year`, `premiere_date`, `type`, `theme`, `sort_order`, `is_published`, `is_premiere`, `uuid`) VALUES
  ('Ночь в опере', 'queen-night-at-the-opera', 'Queen · A Night at the Opera', 'Вечер Queen, пластинка 1975 года. Двенадцать номеров: от злой увертюры до «Bohemian Rhapsody». Зал просим не подпевать до финала.', 1975, '2026-10-03', 'album', 'cabaret', 1, 1, 1, 'b1111111-1111-4111-8111-000000000001');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('Death on Two Legs', 'queen-death-on-two-legs', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 223, 1, 'c1111111-1111-4111-8111-000000000001'),
  ('Lazing on a Sunday Afternoon', 'queen-lazing-on-a-sunday-afternoon', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 68, 1, 'c1111111-1111-4111-8111-000000000002'),
  ('I''m in Love with My Car', 'queen-im-in-love-with-my-car', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 185, 1, 'c1111111-1111-4111-8111-000000000003'),
  ('You''re My Best Friend', 'queen-youre-my-best-friend', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 172, 1, 'c1111111-1111-4111-8111-000000000004'),
  ('''39', 'queen-39', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 211, 1, 'c1111111-1111-4111-8111-000000000005'),
  ('Sweet Lady', 'queen-sweet-lady', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 243, 1, 'c1111111-1111-4111-8111-000000000006'),
  ('Seaside Rendezvous', 'queen-seaside-rendezvous', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 136, 1, 'c1111111-1111-4111-8111-000000000007'),
  ('The Prophet''s Song', 'queen-the-prophets-song', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 501, 1, 'c1111111-1111-4111-8111-000000000008'),
  ('Love of My Life', 'queen-love-of-my-life', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 219, 1, 'c1111111-1111-4111-8111-000000000009'),
  ('Good Company', 'queen-good-company', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 206, 1, 'c1111111-1111-4111-8111-000000000010'),
  ('Bohemian Rhapsody', 'queen-bohemian-rhapsody', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 355, 1, 'c1111111-1111-4111-8111-000000000011'),
  ('God Save the Queen', 'queen-god-save-the-queen', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 79, 1, 'c1111111-1111-4111-8111-000000000012');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-night-at-the-opera';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'queen-death-on-two-legs' AS slug, 1 AS n UNION ALL
  SELECT 'queen-lazing-on-a-sunday-afternoon' AS slug, 2 AS n UNION ALL
  SELECT 'queen-im-in-love-with-my-car' AS slug, 3 AS n UNION ALL
  SELECT 'queen-youre-my-best-friend' AS slug, 4 AS n UNION ALL
  SELECT 'queen-39' AS slug, 5 AS n UNION ALL
  SELECT 'queen-sweet-lady' AS slug, 6 AS n UNION ALL
  SELECT 'queen-seaside-rendezvous' AS slug, 7 AS n UNION ALL
  SELECT 'queen-the-prophets-song' AS slug, 8 AS n UNION ALL
  SELECT 'queen-love-of-my-life' AS slug, 9 AS n UNION ALL
  SELECT 'queen-good-company' AS slug, 10 AS n UNION ALL
  SELECT 'queen-bohemian-rhapsody' AS slug, 11 AS n UNION ALL
  SELECT 'queen-god-save-the-queen' AS slug, 12 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'queen-night-at-the-opera';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('freddie-mercury', 'brian-may', 'roger-taylor', 'john-deacon')
WHERE r.slug = 'queen-night-at-the-opera';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-night-at-the-opera';

INSERT INTO `releases` (`title`, `slug`, `subtitle`, `description`, `release_year`, `premiere_date`, `type`, `theme`, `sort_order`, `is_published`, `is_premiere`, `uuid`) VALUES
  ('Новости мира', 'queen-news-of-the-world', 'Queen · News of the World', 'Архивный спектакль по пластинке 1977 года. Топот «We Will Rock You», гимн и тихий блюз в конце.', 1977, '2026-06-20', 'album', 'art-rock', 2, 1, 0, 'b1111111-1111-4111-8111-000000000002');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('We Will Rock You', 'queen-we-will-rock-you', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 122, 1, 'c1111111-1111-4111-8111-000000000013'),
  ('We Are the Champions', 'queen-we-are-the-champions', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 179, 1, 'c1111111-1111-4111-8111-000000000014'),
  ('Sheer Heart Attack', 'queen-sheer-heart-attack', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 207, 1, 'c1111111-1111-4111-8111-000000000015'),
  ('All Dead, All Dead', 'queen-all-dead-all-dead', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 190, 1, 'c1111111-1111-4111-8111-000000000016'),
  ('Spread Your Wings', 'queen-spread-your-wings', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 274, 1, 'c1111111-1111-4111-8111-000000000017'),
  ('Fight from the Inside', 'queen-fight-from-the-inside', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 183, 1, 'c1111111-1111-4111-8111-000000000018'),
  ('Get Down, Make Love', 'queen-get-down-make-love', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 231, 1, 'c1111111-1111-4111-8111-000000000019'),
  ('Sleeping on the Sidewalk', 'queen-sleeping-on-the-sidewalk', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 186, 1, 'c1111111-1111-4111-8111-000000000020'),
  ('Who Needs You', 'queen-who-needs-you', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 187, 1, 'c1111111-1111-4111-8111-000000000021'),
  ('It''s Late', 'queen-its-late', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 387, 1, 'c1111111-1111-4111-8111-000000000022'),
  ('My Melancholy Blues', 'queen-my-melancholy-blues', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 209, 1, 'c1111111-1111-4111-8111-000000000023');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-news-of-the-world';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'queen-we-will-rock-you' AS slug, 1 AS n UNION ALL
  SELECT 'queen-we-are-the-champions' AS slug, 2 AS n UNION ALL
  SELECT 'queen-sheer-heart-attack' AS slug, 3 AS n UNION ALL
  SELECT 'queen-all-dead-all-dead' AS slug, 4 AS n UNION ALL
  SELECT 'queen-spread-your-wings' AS slug, 5 AS n UNION ALL
  SELECT 'queen-fight-from-the-inside' AS slug, 6 AS n UNION ALL
  SELECT 'queen-get-down-make-love' AS slug, 7 AS n UNION ALL
  SELECT 'queen-sleeping-on-the-sidewalk' AS slug, 8 AS n UNION ALL
  SELECT 'queen-who-needs-you' AS slug, 9 AS n UNION ALL
  SELECT 'queen-its-late' AS slug, 10 AS n UNION ALL
  SELECT 'queen-my-melancholy-blues' AS slug, 11 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'queen-news-of-the-world';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('freddie-mercury', 'brian-may', 'roger-taylor', 'john-deacon')
WHERE r.slug = 'queen-news-of-the-world';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-news-of-the-world';

INSERT INTO `releases` (`title`, `slug`, `subtitle`, `description`, `release_year`, `premiere_date`, `type`, `theme`, `sort_order`, `is_published`, `is_premiere`, `uuid`) VALUES
  ('Иннуэндо', 'queen-innuendo', 'Queen · Innuendo', 'Премьера назначена на декабрь. Длинная заставка и «The Show Must Go On» в самом конце.', 1991, '2026-12-05', 'album', 'night', 3, 1, 0, 'b1111111-1111-4111-8111-000000000003');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('Innuendo', 'queen-innuendo', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 391, 1, 'c1111111-1111-4111-8111-000000000024'),
  ('I''m Going Slightly Mad', 'queen-im-going-slightly-mad', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 262, 1, 'c1111111-1111-4111-8111-000000000025'),
  ('Headlong', 'queen-headlong', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 278, 1, 'c1111111-1111-4111-8111-000000000026'),
  ('I Can''t Live with You', 'queen-i-cant-live-with-you', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 275, 1, 'c1111111-1111-4111-8111-000000000027'),
  ('Don''t Try So Hard', 'queen-dont-try-so-hard', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 219, 1, 'c1111111-1111-4111-8111-000000000028'),
  ('Ride the Wild Wind', 'queen-ride-the-wild-wind', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 282, 1, 'c1111111-1111-4111-8111-000000000029'),
  ('All God''s People', 'queen-all-gods-people', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 261, 1, 'c1111111-1111-4111-8111-000000000030'),
  ('These Are the Days of Our Lives', 'queen-these-are-the-days-of-our-lives', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 255, 1, 'c1111111-1111-4111-8111-000000000031'),
  ('Delilah', 'queen-delilah', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 214, 1, 'c1111111-1111-4111-8111-000000000032'),
  ('The Hitman', 'queen-the-hitman', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 296, 1, 'c1111111-1111-4111-8111-000000000033'),
  ('Bijou', 'queen-bijou', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 216, 1, 'c1111111-1111-4111-8111-000000000034'),
  ('The Show Must Go On', 'queen-the-show-must-go-on', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 272, 1, 'c1111111-1111-4111-8111-000000000035');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-innuendo';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'queen-innuendo' AS slug, 1 AS n UNION ALL
  SELECT 'queen-im-going-slightly-mad' AS slug, 2 AS n UNION ALL
  SELECT 'queen-headlong' AS slug, 3 AS n UNION ALL
  SELECT 'queen-i-cant-live-with-you' AS slug, 4 AS n UNION ALL
  SELECT 'queen-dont-try-so-hard' AS slug, 5 AS n UNION ALL
  SELECT 'queen-ride-the-wild-wind' AS slug, 6 AS n UNION ALL
  SELECT 'queen-all-gods-people' AS slug, 7 AS n UNION ALL
  SELECT 'queen-these-are-the-days-of-our-lives' AS slug, 8 AS n UNION ALL
  SELECT 'queen-delilah' AS slug, 9 AS n UNION ALL
  SELECT 'queen-the-hitman' AS slug, 10 AS n UNION ALL
  SELECT 'queen-bijou' AS slug, 11 AS n UNION ALL
  SELECT 'queen-the-show-must-go-on' AS slug, 12 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'queen-innuendo';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('freddie-mercury', 'brian-may', 'roger-taylor', 'john-deacon')
WHERE r.slug = 'queen-innuendo';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-innuendo';

INSERT INTO `releases` (`title`, `slug`, `subtitle`, `description`, `release_year`, `premiere_date`, `type`, `theme`, `sort_order`, `is_published`, `is_premiere`, `uuid`) VALUES
  ('Квадратный метр', 'kovry-kvadratny-metr', 'Ковры квадратные', 'Домашний вечер Ковров квадратных. Шесть песен про комнату, где ковёр лежит строго по углам.', 2024, '2026-08-08', 'album', 'ember', 4, 1, 0, 'b1111111-1111-4111-8111-000000000004');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('Кромка', 'kovry-kromka', 'Ковры квадратные', 'Нина ведёт пальцем по краю.
Край тёплый, край прямой.
За краем уже не наш пол.
Мы поём только внутри.', 'CG', 0, 154, 1, 'c1111111-1111-4111-8111-000000000036'),
  ('Прямой угол', 'kovry-pryamoy-ugol', 'Ковры квадратные', 'Четыре угла, и все прямые.
Лев считает их вслух.
На четвёртом зал смеётся.
Мы не смеёмся: так лежит.', 'CG', 0, 168, 1, 'c1111111-1111-4111-8111-000000000037'),
  ('Ворс наружу', 'kovry-vors-naruzhu', 'Ковры квадратные', 'Ворс смотрит в потолок.
По нему не ходят боком.
Если лечь — слышно дом.
Если встать — слышно нас.', 'CG', 0, 141, 1, 'c1111111-1111-4111-8111-000000000038'),
  ('Бахрома молчит', 'kovry-bahroma-molchit', 'Ковры квадратные', 'Бахрома сегодня молчит.
Ей нечего добавить к куплету.
Марк держит тишину на полу.
Мы входим в неё босиком.', 'CG', 0, 132, 1, 'c1111111-1111-4111-8111-000000000039'),
  ('Середина', 'kovry-seredina', 'Ковры квадратные', 'Середина комнаты пуста.
Туда ставят гостя.
Гость не знает, где кромка.
Мы показываем взглядом.', 'CG', 0, 176, 1, 'c1111111-1111-4111-8111-000000000040'),
  ('Снять обувь', 'kovry-snyat-obuv', 'Ковры квадратные', 'У двери два ряда обуви.
Спектакль начинается с этого.
Дальше только носки и голос.
Квадратный метр держит обоих.', 'CG', 0, 149, 1, 'c1111111-1111-4111-8111-000000000041');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'bard'
WHERE r.slug = 'kovry-kvadratny-metr';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'kovry-kromka' AS slug, 1 AS n UNION ALL
  SELECT 'kovry-pryamoy-ugol' AS slug, 2 AS n UNION ALL
  SELECT 'kovry-vors-naruzhu' AS slug, 3 AS n UNION ALL
  SELECT 'kovry-bahroma-molchit' AS slug, 4 AS n UNION ALL
  SELECT 'kovry-seredina' AS slug, 5 AS n UNION ALL
  SELECT 'kovry-snyat-obuv' AS slug, 6 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'kovry-kvadratny-metr';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('nina-kromka', 'lev-utok', 'mark-parket')
WHERE r.slug = 'kovry-kvadratny-metr';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'bard'
WHERE r.slug = 'kovry-kvadratny-metr';

INSERT INTO `releases` (`title`, `slug`, `subtitle`, `description`, `release_year`, `premiere_date`, `type`, `theme`, `sort_order`, `is_published`, `is_premiere`, `uuid`) VALUES
  ('Поле', 'kovry-pole', 'Ковры квадратные', 'Новая постановка. Ковёр выносят за город и кладут на траву. Премьера 14 ноября.', 2026, '2026-11-14', 'album', 'romance', 5, 1, 0, 'b1111111-1111-4111-8111-000000000005');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('За городом', 'kovry-za-gorodom', 'Ковры квадратные', 'За городом пол кончается.
Нина выходит первой.
В руках свёрнутый квадрат.
Ветер уже пробует край.', 'CG', 0, 160, 1, 'c1111111-1111-4111-8111-000000000042'),
  ('Квадрат травы', 'kovry-kvadrat-travy', 'Ковры квадратные', 'Кладём так, чтобы углы
смотрели на четыре стороны.
Трава не подчиняется.
Мы подчиняемся траве.', 'CG', 0, 188, 1, 'c1111111-1111-4111-8111-000000000043'),
  ('Ветер по кромке', 'kovry-veter-po-kromke', 'Ковры квадратные', 'Ветер идёт вдоль кромки,
как суфлёр вдоль кулисы.
Лев повторяет за ним
только то, что можно спеть.', 'CG', 0, 147, 1, 'c1111111-1111-4111-8111-000000000044'),
  ('Стог', 'kovry-stog', 'Ковры квадратные', 'Стог — тоже квадрат,
если смотреть издалека и сощурясь.
Марк не сощуривается.
Он отбивает ровно.', 'CG', 0, 171, 1, 'c1111111-1111-4111-8111-000000000045'),
  ('Обратно к паркету', 'kovry-obratno-k-parketu', 'Ковры квадратные', 'Сворачиваем к антракту.
В зале снова пахнет деревом.
Поле остаётся за дверью.
Ковёр помнит и то и другое.', 'CG', 0, 155, 1, 'c1111111-1111-4111-8111-000000000046');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'bard'
WHERE r.slug = 'kovry-pole';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'kovry-za-gorodom' AS slug, 1 AS n UNION ALL
  SELECT 'kovry-kvadrat-travy' AS slug, 2 AS n UNION ALL
  SELECT 'kovry-veter-po-kromke' AS slug, 3 AS n UNION ALL
  SELECT 'kovry-stog' AS slug, 4 AS n UNION ALL
  SELECT 'kovry-obratno-k-parketu' AS slug, 5 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'kovry-pole';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('nina-kromka', 'lev-utok', 'mark-parket')
WHERE r.slug = 'kovry-pole';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'bard'
WHERE r.slug = 'kovry-pole';

INSERT INTO `users` (`client_id`, `nickname`) VALUES
  ('c0ffee00-0000-4000-8000-0000000000a1', 'Лена из партера'),
  ('c0ffee00-0000-4000-8000-0000000000a2', 'Пётр с балкона');

INSERT INTO `reviews` (`release_id`, `user_id`, `content`, `status`)
SELECT r.id, u.id, 'После «Bohemian Rhapsody» зал ещё секунду молчал. Потом уже нельзя было усидеть.', 'approved'
FROM `releases` r
JOIN `users` u ON u.client_id = 'c0ffee00-0000-4000-8000-0000000000a1'
WHERE r.slug = 'queen-night-at-the-opera';

INSERT INTO `reviews` (`release_id`, `user_id`, `content`, `status`)
SELECT r.id, u.id, 'Ковёр лежит ровно, а голоса — нет. Так и надо.', 'approved'
FROM `releases` r
JOIN `users` u ON u.client_id = 'c0ffee00-0000-4000-8000-0000000000a2'
WHERE r.slug = 'kovry-kvadratny-metr';

INSERT INTO `news` (`title`, `content`, `is_published`) VALUES
  ('Ночь в опере', 'Сегодня на сцене Queen: «Ночь в опере», от увертюры до «Bohemian Rhapsody».', 1),
  ('Поле в ноябре', '14 ноября Ковры квадратные стелют новую постановку «Поле».', 1),
  ('Архив зала', 'В архиве уже идут «Новости мира» и «Квадратный метр».', 1);

COMMIT;

SELECT
  (SELECT COUNT(*) FROM `releases`) AS releases,
  (SELECT COUNT(*) FROM `tracks`) AS tracks,
  (SELECT COUNT(*) FROM `artists`) AS artists;
