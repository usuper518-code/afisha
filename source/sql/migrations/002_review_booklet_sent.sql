-- Очередь именного буклета: пустая дата значит «ещё не отправляли».
-- Для уже развёрнутой базы. В новом catalog.sql колонка уже есть.

ALTER TABLE `reviews`
  ADD COLUMN `booklet_sent_at` timestamp NULL DEFAULT NULL COMMENT 'когда именной буклет ушёл на почту' AFTER `want_booklet`;
