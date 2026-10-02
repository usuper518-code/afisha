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
