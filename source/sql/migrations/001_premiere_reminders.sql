-- Очередь писем «напомнить о премьере».
-- Для уже развёрнутой базы. В новом catalog.sql таблица уже есть.

CREATE TABLE IF NOT EXISTS `premiere_reminders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `release_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `sent_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_release` (`user_id`, `release_id`),
  KEY `idx_unsent` (`sent_at`, `release_id`),
  CONSTRAINT `premiere_reminders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `premiere_reminders_release` FOREIGN KEY (`release_id`) REFERENCES `releases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
