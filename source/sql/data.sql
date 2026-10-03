-- Наполнение базы catalog программой.
-- Нужны пустые таблицы: сначала source/sql/create.sql.
-- Три вечера Queen и два вечера «Ковры квадратные».
-- Текстов песен Queen и коммерческих записей здесь нет.
-- Обложки и страницы этот файл не создаёт.
--
-- Запуск из корня репозитория:
--   mysql -uroot -p --default-character-set=utf8mb4 < source/sql/data.sql

USE `catalog`;

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
