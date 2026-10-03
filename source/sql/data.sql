-- Наполнение базы catalog программой Queen.
-- Нужны пустые таблицы: сначала source/sql/create.sql.
-- Премьера сегодня, два вечера впереди, два уже в архиве.
-- Текстов песен и коммерческих записей здесь нет.
-- Обложки и ролики рисует source/sql/seed-realistic.py.
--
-- Запуск из корня репозитория:
--   mysql -uroot -p --default-character-set=utf8mb4 < source/sql/data.sql

USE `catalog`;

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO `genres` (`name`, `slug`) VALUES
  ('Рок', 'rok');

INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
  ('site_title', 'Студия'),
  ('site_tagline', 'Акустический театр.'),
  ('slogan', 'Шоу должно продолжаться.'),
  ('about_text', 'Студия ставит пластинки Queen как спектакли. На сцене четверо: голос, гитара, ударные и бас. Сегодня премьера, два вечера ещё впереди, два уже в архиве.'),
  ('default_author', 'Queen'),
  ('author_bio', 'Фредди Меркьюри, Брайан Мэй, Роджер Тейлор и Джон Дикон. На афише это состав вечера.'),
  ('metrika_id', '0'),
  ('stihi_url', ''),
  ('telegram_url', '');

INSERT INTO `artists` (`name`, `slug`, `voice_type`, `description`, `is_active`, `sort_order`, `uuid`) VALUES
  ('Фредди Меркьюри', 'freddie-mercury', 'тенор', 'Голос рампы Queen.', 1, 1, 'a1111111-1111-4111-8111-000000000001'),
  ('Брайан Мэй', 'brian-may', 'гитара', 'Красная гитара, длинные фразы.', 1, 2, 'a1111111-1111-4111-8111-000000000002'),
  ('Роджер Тейлор', 'roger-taylor', 'ударные', 'Топот и высокий подголосок.', 1, 3, 'a1111111-1111-4111-8111-000000000003'),
  ('Джон Дикон', 'john-deacon', 'бас', 'Держит низ, почти не выходит к рампе.', 1, 4, 'a1111111-1111-4111-8111-000000000004');

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
  ('Игра', 'queen-the-game', 'Queen · The Game', 'Архивный вечер 1980 года. Десять номеров: от «Play the Game» до «Save Me».', 1980, '2026-03-27', 'album', 'ember', 4, 1, 0, 'b1111111-1111-4111-8111-000000000004');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('Play the Game', 'queen-play-the-game', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 210, 1, 'c1111111-1111-4111-8111-000000000036'),
  ('Dragon Attack', 'queen-dragon-attack', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 258, 1, 'c1111111-1111-4111-8111-000000000037'),
  ('Another One Bites the Dust', 'queen-another-one-bites-the-dust', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 215, 1, 'c1111111-1111-4111-8111-000000000038'),
  ('Need Your Loving Tonight', 'queen-need-your-loving-tonight', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 170, 1, 'c1111111-1111-4111-8111-000000000039'),
  ('Crazy Little Thing Called Love', 'queen-crazy-little-thing-called-love', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 162, 1, 'c1111111-1111-4111-8111-000000000040'),
  ('Rock It (Prime Jive)', 'queen-rock-it-prime-jive', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 273, 1, 'c1111111-1111-4111-8111-000000000041'),
  ('Don''t Try Suicide', 'queen-dont-try-suicide', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 232, 1, 'c1111111-1111-4111-8111-000000000042'),
  ('Sail Away Sweet Sister', 'queen-sail-away-sweet-sister', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 213, 1, 'c1111111-1111-4111-8111-000000000043'),
  ('Coming Soon', 'queen-coming-soon', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 171, 1, 'c1111111-1111-4111-8111-000000000044'),
  ('Save Me', 'queen-save-me', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 228, 1, 'c1111111-1111-4111-8111-000000000045');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-the-game';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'queen-play-the-game' AS slug, 1 AS n UNION ALL
  SELECT 'queen-dragon-attack' AS slug, 2 AS n UNION ALL
  SELECT 'queen-another-one-bites-the-dust' AS slug, 3 AS n UNION ALL
  SELECT 'queen-need-your-loving-tonight' AS slug, 4 AS n UNION ALL
  SELECT 'queen-crazy-little-thing-called-love' AS slug, 5 AS n UNION ALL
  SELECT 'queen-rock-it-prime-jive' AS slug, 6 AS n UNION ALL
  SELECT 'queen-dont-try-suicide' AS slug, 7 AS n UNION ALL
  SELECT 'queen-sail-away-sweet-sister' AS slug, 8 AS n UNION ALL
  SELECT 'queen-coming-soon' AS slug, 9 AS n UNION ALL
  SELECT 'queen-save-me' AS slug, 10 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'queen-the-game';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('freddie-mercury', 'brian-may', 'roger-taylor', 'john-deacon')
WHERE r.slug = 'queen-the-game';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-the-game';

INSERT INTO `releases` (`title`, `slug`, `subtitle`, `description`, `release_year`, `premiere_date`, `type`, `theme`, `sort_order`, `is_published`, `is_premiere`, `uuid`) VALUES
  ('Вид волшебства', 'queen-a-kind-of-magic', 'Queen · A Kind of Magic', 'Вечер назначен на ноябрь. Девять номеров пластинки 1986 года, финал — «Princes of the Universe».', 1986, '2026-11-21', 'album', 'romance', 5, 1, 0, 'b1111111-1111-4111-8111-000000000005');

INSERT INTO `tracks` (`title`, `slug`, `authors`, `lyrics`, `suggested_emotions`, `is_instrumental`, `duration`, `is_published`, `uuid`) VALUES
  ('One Vision', 'queen-one-vision', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 310, 1, 'c1111111-1111-4111-8111-000000000046'),
  ('A Kind of Magic', 'queen-a-kind-of-magic', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 264, 1, 'c1111111-1111-4111-8111-000000000047'),
  ('One Year of Love', 'queen-one-year-of-love', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 266, 1, 'c1111111-1111-4111-8111-000000000048'),
  ('Pain Is So Close to Pleasure', 'queen-pain-is-so-close-to-pleasure', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 261, 1, 'c1111111-1111-4111-8111-000000000049'),
  ('Friends Will Be Friends', 'queen-friends-will-be-friends', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 247, 1, 'c1111111-1111-4111-8111-000000000050'),
  ('Who Wants to Live Forever', 'queen-who-wants-to-live-forever', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 315, 1, 'c1111111-1111-4111-8111-000000000051'),
  ('Gimme the Prize', 'queen-gimme-the-prize', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 274, 1, 'c1111111-1111-4111-8111-000000000052'),
  ('Don''t Lose Your Head', 'queen-dont-lose-your-head', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 278, 1, 'c1111111-1111-4111-8111-000000000053'),
  ('Princes of the Universe', 'queen-princes-of-the-universe', 'Queen', 'Текст песни в программку не печатаем.', 'DF', 0, 212, 1, 'c1111111-1111-4111-8111-000000000054');

INSERT INTO `release_genre` (`release_id`, `genre_id`)
SELECT r.id, g.id FROM `releases` r JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-a-kind-of-magic';

INSERT INTO `release_tracks` (`release_id`, `track_id`, `track_number`)
SELECT r.id, t.id, nums.n
FROM `releases` r
JOIN (
  SELECT 'queen-one-vision' AS slug, 1 AS n UNION ALL
  SELECT 'queen-a-kind-of-magic' AS slug, 2 AS n UNION ALL
  SELECT 'queen-one-year-of-love' AS slug, 3 AS n UNION ALL
  SELECT 'queen-pain-is-so-close-to-pleasure' AS slug, 4 AS n UNION ALL
  SELECT 'queen-friends-will-be-friends' AS slug, 5 AS n UNION ALL
  SELECT 'queen-who-wants-to-live-forever' AS slug, 6 AS n UNION ALL
  SELECT 'queen-gimme-the-prize' AS slug, 7 AS n UNION ALL
  SELECT 'queen-dont-lose-your-head' AS slug, 8 AS n UNION ALL
  SELECT 'queen-princes-of-the-universe' AS slug, 9 AS n
) nums
JOIN `tracks` t ON t.slug = nums.slug
WHERE r.slug = 'queen-a-kind-of-magic';

INSERT INTO `track_artists` (`track_id`, `artist_id`)
SELECT t.id, a.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `artists` a ON a.slug IN ('freddie-mercury', 'brian-may', 'roger-taylor', 'john-deacon')
WHERE r.slug = 'queen-a-kind-of-magic';

INSERT INTO `track_genre` (`track_id`, `genre_id`)
SELECT t.id, g.id
FROM `tracks` t
JOIN `release_tracks` rt ON rt.track_id = t.id
JOIN `releases` r ON r.id = rt.release_id
JOIN `genres` g ON g.slug = 'rok'
WHERE r.slug = 'queen-a-kind-of-magic';

INSERT INTO `users` (`client_id`, `nickname`) VALUES
  ('c0ffee00-0000-4000-8000-0000000000a1', 'Лена из партера'),
  ('c0ffee00-0000-4000-8000-0000000000a2', 'Пётр с балкона');

INSERT INTO `reviews` (`release_id`, `user_id`, `content`, `status`)
SELECT r.id, u.id, 'После «Bohemian Rhapsody» зал ещё секунду молчал. Потом уже нельзя было усидеть.', 'approved'
FROM `releases` r
JOIN `users` u ON u.client_id = 'c0ffee00-0000-4000-8000-0000000000a1'
WHERE r.slug = 'queen-night-at-the-opera';

INSERT INTO `reviews` (`release_id`, `user_id`, `content`, `status`)
SELECT r.id, u.id, '«We Will Rock You» топали всем рядом. Архив звучит, как будто спектакль ещё идёт.', 'approved'
FROM `releases` r
JOIN `users` u ON u.client_id = 'c0ffee00-0000-4000-8000-0000000000a2'
WHERE r.slug = 'queen-news-of-the-world';

INSERT INTO `news` (`title`, `content`, `is_published`) VALUES
  ('Ночь в опере', 'Сегодня на сцене Queen: «Ночь в опере», от увертюры до «Bohemian Rhapsody».', 1),
  ('Два вечера впереди', '21 ноября «Вид волшебства», 5 декабря «Иннуэндо».', 1),
  ('Архив зала', 'В архиве уже идут «Новости мира» и «Игра».', 1);

COMMIT;

SELECT
  (SELECT COUNT(*) FROM `releases`) AS releases,
  (SELECT COUNT(*) FROM `tracks`) AS tracks,
  (SELECT COUNT(*) FROM `artists`) AS artists,
  (SELECT COUNT(*) FROM `settings`) AS settings;
