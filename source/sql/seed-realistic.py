#!/usr/bin/env python3
# Заполняет рабочую базу catalog программой спектаклей и рисует обложки.
# Запуск из корня репозитория: python3 source/sql/seed-realistic.py
#
# Queen — настоящие названия и длительности пластинок. Текстов песен
# и коммерческих записей здесь нет: в плеере короткий шум зала.
# «Ковры квадратные» — домашний вечер студии, слова написаны для сцены.

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "source"
UPLOADS = SOURCE / "uploads"
AUDIO_SRC = UPLOADS / "track" / "11111111-1111-4111-8111-111111111111" / "audio.mp3"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MYSQL = ["mysql", "-uroot", "-p12345", "catalog"]
NOTE = "Текст песни в программку не печатаем."

def u(kind, n):
    return f"{kind}1111111-1111-4111-8111-{n:012d}"

ARTISTS = [
    ("Фредди Меркьюри", "freddie-mercury", "тенор", "Голос рампы Queen.", u("a", 1), (180, 40, 50)),
    ("Брайан Мэй", "brian-may", "гитара", "Красная гитара, длинные фразы.", u("a", 2), (120, 70, 30)),
    ("Роджер Тейлор", "roger-taylor", "ударные", "Топот и высокий подголосок.", u("a", 3), (70, 80, 120)),
    ("Джон Дикон", "john-deacon", "бас", "Держит низ, почти не выходит к рампе.", u("a", 4), (40, 70, 80)),
    ("Нина Кромка", "nina-kromka", "сопрано", "Ковры квадратные. Поёт кромку и углы.", u("a", 5), (140, 90, 50)),
    ("Лев Уток", "lev-utok", "баритон", "Ковры квадратные. Говорит, будто стелет.", u("a", 6), (50, 90, 70)),
    ("Марк Паркет", "mark-parket", "инструментал", "Ковры квадратные. Пол, метроном, тишина.", u("a", 7), (90, 70, 40)),
]

# slug, title, subtitle, year, premiere, theme, premiere_flag, description, color, genre, tracks
# track: title, slug, seconds, authors-slugs, lyrics or None (None → NOTE, instrumental flag 0)

QUEEN = ["freddie-mercury", "brian-may", "roger-taylor", "john-deacon"]
KOVRY = ["nina-kromka", "lev-utok", "mark-parket"]

RELEASES = [
    {
        "slug": "queen-night-at-the-opera",
        "title": "Ночь в опере",
        "subtitle": "Queen · A Night at the Opera",
        "year": 1975,
        "premiere": "2026-10-03",
        "theme": "cabaret",
        "flag": 1,
        "genre": "rok",
        "color": (92, 18, 28),
        "accent": (212, 175, 90),
        "description": "Вечер Queen, пластинка 1975 года. Двенадцать номеров: от злой увертюры до «Bohemian Rhapsody». Зал просим не подпевать до финала.",
        "tracks": [
            ("Death on Two Legs", "queen-death-on-two-legs", 223),
            ("Lazing on a Sunday Afternoon", "queen-lazing-on-a-sunday-afternoon", 68),
            ("I'm in Love with My Car", "queen-im-in-love-with-my-car", 185),
            ("You're My Best Friend", "queen-youre-my-best-friend", 172),
            ("'39", "queen-39", 211),
            ("Sweet Lady", "queen-sweet-lady", 243),
            ("Seaside Rendezvous", "queen-seaside-rendezvous", 136),
            ("The Prophet's Song", "queen-the-prophets-song", 501),
            ("Love of My Life", "queen-love-of-my-life", 219),
            ("Good Company", "queen-good-company", 206),
            ("Bohemian Rhapsody", "queen-bohemian-rhapsody", 355),
            ("God Save the Queen", "queen-god-save-the-queen", 79),
        ],
        "cast": QUEEN,
        "lyrics": None,
    },
    {
        "slug": "queen-news-of-the-world",
        "title": "Новости мира",
        "subtitle": "Queen · News of the World",
        "year": 1977,
        "premiere": "2026-06-20",
        "theme": "art-rock",
        "flag": 0,
        "genre": "rok",
        "color": (28, 28, 32),
        "accent": (230, 220, 190),
        "description": "Архивный спектакль по пластинке 1977 года. Топот «We Will Rock You», гимн и тихий блюз в конце.",
        "tracks": [
            ("We Will Rock You", "queen-we-will-rock-you", 122),
            ("We Are the Champions", "queen-we-are-the-champions", 179),
            ("Sheer Heart Attack", "queen-sheer-heart-attack", 207),
            ("All Dead, All Dead", "queen-all-dead-all-dead", 190),
            ("Spread Your Wings", "queen-spread-your-wings", 274),
            ("Fight from the Inside", "queen-fight-from-the-inside", 183),
            ("Get Down, Make Love", "queen-get-down-make-love", 231),
            ("Sleeping on the Sidewalk", "queen-sleeping-on-the-sidewalk", 186),
            ("Who Needs You", "queen-who-needs-you", 187),
            ("It's Late", "queen-its-late", 387),
            ("My Melancholy Blues", "queen-my-melancholy-blues", 209),
        ],
        "cast": QUEEN,
        "lyrics": None,
    },
    {
        "slug": "queen-innuendo",
        "title": "Иннуэндо",
        "subtitle": "Queen · Innuendo",
        "year": 1991,
        "premiere": "2026-12-05",
        "theme": "night",
        "flag": 0,
        "genre": "rok",
        "color": (18, 22, 48),
        "accent": (180, 170, 210),
        "description": "Премьера назначена на декабрь. Длинная заставка и «The Show Must Go On» в самом конце.",
        "tracks": [
            ("Innuendo", "queen-innuendo", 391),
            ("I'm Going Slightly Mad", "queen-im-going-slightly-mad", 262),
            ("Headlong", "queen-headlong", 278),
            ("I Can't Live with You", "queen-i-cant-live-with-you", 275),
            ("Don't Try So Hard", "queen-dont-try-so-hard", 219),
            ("Ride the Wild Wind", "queen-ride-the-wild-wind", 282),
            ("All God's People", "queen-all-gods-people", 261),
            ("These Are the Days of Our Lives", "queen-these-are-the-days-of-our-lives", 255),
            ("Delilah", "queen-delilah", 214),
            ("The Hitman", "queen-the-hitman", 296),
            ("Bijou", "queen-bijou", 216),
            ("The Show Must Go On", "queen-the-show-must-go-on", 272),
        ],
        "cast": QUEEN,
        "lyrics": None,
    },
    {
        "slug": "kovry-kvadratny-metr",
        "title": "Квадратный метр",
        "subtitle": "Ковры квадратные",
        "year": 2024,
        "premiere": "2026-08-08",
        "theme": "ember",
        "flag": 0,
        "genre": "bard",
        "color": (110, 62, 36),
        "accent": (230, 190, 130),
        "description": "Домашний вечер Ковров квадратных. Шесть песен про комнату, где ковёр лежит строго по углам.",
        "tracks": [
            ("Кромка", "kovry-kromka", 154, "Нина ведёт пальцем по краю.\nКрай тёплый, край прямой.\nЗа краем уже не наш пол.\nМы поём только внутри."),
            ("Прямой угол", "kovry-pryamoy-ugol", 168, "Четыре угла, и все прямые.\nЛев считает их вслух.\nНа четвёртом зал смеётся.\nМы не смеёмся: так лежит."),
            ("Ворс наружу", "kovry-vors-naruzhu", 141, "Ворс смотрит в потолок.\nПо нему не ходят боком.\nЕсли лечь — слышно дом.\nЕсли встать — слышно нас."),
            ("Бахрома молчит", "kovry-bahroma-molchit", 132, "Бахрома сегодня молчит.\nЕй нечего добавить к куплету.\nМарк держит тишину на полу.\nМы входим в неё босиком."),
            ("Середина", "kovry-seredina", 176, "Середина комнаты пуста.\nТуда ставят гостя.\nГость не знает, где кромка.\nМы показываем взглядом."),
            ("Снять обувь", "kovry-snyat-obuv", 149, "У двери два ряда обуви.\nСпектакль начинается с этого.\nДальше только носки и голос.\nКвадратный метр держит обоих."),
        ],
        "cast": KOVRY,
        "lyrics": "own",
    },
    {
        "slug": "kovry-pole",
        "title": "Поле",
        "subtitle": "Ковры квадратные",
        "year": 2026,
        "premiere": "2026-11-14",
        "theme": "romance",
        "flag": 0,
        "genre": "bard",
        "color": (36, 72, 48),
        "accent": (210, 190, 120),
        "description": "Новая постановка. Ковёр выносят за город и кладут на траву. Премьера 14 ноября.",
        "tracks": [
            ("За городом", "kovry-za-gorodom", 160, "За городом пол кончается.\nНина выходит первой.\nВ руках свёрнутый квадрат.\nВетер уже пробует край."),
            ("Квадрат травы", "kovry-kvadrat-travy", 188, "Кладём так, чтобы углы\nсмотрели на четыре стороны.\nТрава не подчиняется.\nМы подчиняемся траве."),
            ("Ветер по кромке", "kovry-veter-po-kromke", 147, "Ветер идёт вдоль кромки,\nкак суфлёр вдоль кулисы.\nЛев повторяет за ним\nтолько то, что можно спеть."),
            ("Стог", "kovry-stog", 171, "Стог — тоже квадрат,\nесли смотреть издалека и сощурясь.\nМарк не сощуривается.\nОн отбивает ровно."),
            ("Обратно к паркету", "kovry-obratno-k-parketu", 155, "Сворачиваем к антракту.\nВ зале снова пахнет деревом.\nПоле остаётся за дверью.\nКовёр помнит и то и другое."),
        ],
        "cast": KOVRY,
        "lyrics": "own",
    },
]


def sql(query):
    subprocess.run(MYSQL + ["-e", query], check=True)


def sql_script(text):
    subprocess.run(MYSQL, input=text.encode(), check=True)


def q(value):
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def paint_cover(path, title, subtitle, color, accent):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (900, 900), color)
    draw = ImageDraw.Draw(img)
    draw.rectangle((48, 48, 852, 852), outline=accent, width=6)
    draw.rectangle((78, 78, 822, 822), outline=accent, width=2)
    title_font = ImageFont.truetype(FONT, 64)
    sub_font = ImageFont.truetype(FONT_REG, 32)
    words = title.split()
    lines = []
    current = ""
    for word in words:
        trial = (current + " " + word).strip()
        if draw.textlength(trial, font=title_font) < 700:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    y = 360 - 40 * len(lines)
    for line in lines:
        w = draw.textlength(line, font=title_font)
        draw.text(((900 - w) / 2, y), line, font=title_font, fill=accent)
        y += 78
    w = draw.textlength(subtitle, font=sub_font)
    draw.text(((900 - w) / 2, y + 20), subtitle, font=sub_font, fill=(235, 228, 214))
    img.save(path, quality=90)


def paint_avatar(path, color):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (400, 400), (12, 10, 12))
    draw = ImageDraw.Draw(img)
    draw.ellipse((40, 40, 360, 360), fill=color)
    img.save(path, quality=90)


def main():
    if not AUDIO_SRC.is_file():
        raise SystemExit("нет короткого файла шума зала: " + str(AUDIO_SRC))

    sql_script("""
UPDATE releases SET is_published = 0, is_premiere = 0
 WHERE slug IN ('client-future', 'client-past', 'client-soon');
UPDATE artists SET is_active = 0 WHERE slug = 'client-voice';
UPDATE news SET is_published = 0
 WHERE content LIKE '%onerror%' OR content LIKE '%<img%';
""")

    our_track_slugs = []
    for rel in RELEASES:
        for item in rel["tracks"]:
            our_track_slugs.append(item[1])
    slug_list = ",".join(q(s) for s in our_track_slugs)
    rel_list = ",".join(q(r["slug"]) for r in RELEASES)
    sql(f"DELETE FROM tracks WHERE slug IN ({slug_list})")
    sql(f"DELETE FROM releases WHERE slug IN ({rel_list})")
    artist_list = ",".join(q(a[1]) for a in ARTISTS)
    sql(f"DELETE FROM artists WHERE slug IN ({artist_list})")
    sql("DELETE FROM users WHERE client_id IN ('c0ffee00-0000-4000-8000-0000000000a1','c0ffee00-0000-4000-8000-0000000000a2')")
    sql("DELETE FROM news WHERE title IN ('Ночь в опере','Поле в ноябре','Архив зала')")
    sql("""
INSERT INTO genres (name, slug)
SELECT 'Рок', 'rok' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM genres WHERE slug = 'rok');
INSERT INTO genres (name, slug)
SELECT 'Авторская', 'bard' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM genres WHERE slug = 'bard');
""")

    for order, (name, slug, voice, bio, uuid, _color) in enumerate(ARTISTS, start=1):
        sql(
            "INSERT INTO artists (name, slug, voice_type, description, is_active, sort_order, uuid) VALUES ("
            + ",".join([q(name), q(slug), q(voice), q(bio), "1", str(order), q(uuid)])
            + ")"
        )

    n = 1
    for rel in RELEASES:
        ru = u("b", RELEASES.index(rel) + 1)
        rel["uuid"] = ru
        sql(
            "INSERT INTO releases (title, slug, subtitle, description, release_year, premiere_date, type, theme, sort_order, is_published, is_premiere, uuid) VALUES ("
            + ",".join([
                q(rel["title"]), q(rel["slug"]), q(rel["subtitle"]), q(rel["description"]),
                str(rel["year"]), q(rel["premiere"]), q("album"), q(rel["theme"]),
                str(RELEASES.index(rel) + 1), "1", str(rel["flag"]), q(ru),
            ])
            + ")"
        )
        sql(
            "INSERT INTO release_genre (release_id, genre_id) "
            f"SELECT r.id, g.id FROM releases r JOIN genres g ON g.slug = {q(rel['genre'])} "
            f"WHERE r.slug = {q(rel['slug'])}"
        )
        for num, item in enumerate(rel["tracks"], start=1):
            title, slug, seconds = item[0], item[1], item[2]
            lyrics = NOTE if rel["lyrics"] is None else item[3]
            tu = u("c", n)
            n += 1
            sql(
                "INSERT INTO tracks (title, slug, authors, lyrics, suggested_emotions, is_instrumental, duration, is_published, uuid) VALUES ("
                + ",".join([
                    q(title), q(slug), q("Queen" if rel["cast"] is QUEEN else "Ковры квадратные"), q(lyrics),
                    q("DF" if rel["cast"] is QUEEN else "CG"),
                    "0", str(seconds), "1", q(tu),
                ])
                + ")"
            )
            sql(
                "INSERT INTO release_tracks (release_id, track_id, track_number) "
                f"SELECT r.id, t.id, {num} FROM releases r JOIN tracks t ON t.slug = {q(slug)} "
                f"WHERE r.slug = {q(rel['slug'])}"
            )
            for artist_slug in rel["cast"]:
                sql(
                    "INSERT INTO track_artists (track_id, artist_id) "
                    f"SELECT t.id, a.id FROM tracks t JOIN artists a ON a.slug = {q(artist_slug)} "
                    f"WHERE t.slug = {q(slug)}"
                )
            sql(
                "INSERT INTO track_genre (track_id, genre_id) "
                f"SELECT t.id, g.id FROM tracks t JOIN genres g ON g.slug = {q(rel['genre'])} "
                f"WHERE t.slug = {q(slug)}"
            )

    sql("""
INSERT INTO users (client_id, nickname) VALUES
('c0ffee00-0000-4000-8000-0000000000a1', 'Лена из партера'),
('c0ffee00-0000-4000-8000-0000000000a2', 'Пётр с балкона');
INSERT INTO reviews (release_id, user_id, content, status)
SELECT r.id, u.id, 'После «Bohemian Rhapsody» зал ещё секунду молчал. Потом уже нельзя было усидеть.', 'approved'
FROM releases r JOIN users u ON u.client_id = 'c0ffee00-0000-4000-8000-0000000000a1'
WHERE r.slug = 'queen-night-at-the-opera';
INSERT INTO reviews (release_id, user_id, content, status)
SELECT r.id, u.id, 'Ковёр лежит ровно, а голоса — нет. Так и надо.', 'approved'
FROM releases r JOIN users u ON u.client_id = 'c0ffee00-0000-4000-8000-0000000000a2'
WHERE r.slug = 'kovry-kvadratny-metr';
INSERT INTO news (title, content, is_published) VALUES
('Ночь в опере', 'Сегодня на сцене Queen: «Ночь в опере», от увертюры до «Bohemian Rhapsody».', 1),
('Поле в ноябре', '14 ноября Ковры квадратные стелют новую постановку «Поле».', 1),
('Архив зала', 'В архиве уже идут «Новости мира» и «Квадратный метр».', 1);
""")

    rows = subprocess.check_output(
        MYSQL + ["-N", "-e", "SELECT uuid, title, subtitle FROM releases WHERE slug LIKE 'queen-%' OR slug LIKE 'kovry-%'"],
        text=True,
    )
    by_title = {rel["title"]: rel for rel in RELEASES}
    for line in rows.splitlines():
        uuid, title, subtitle = line.split("\t")
        rel = by_title[title]
        paint_cover(UPLOADS / "release" / uuid / "cover.jpg", title, subtitle, rel["color"], rel["accent"])

    track_rows = subprocess.check_output(
        MYSQL + ["-N", "-e", "SELECT t.uuid, r.title, t.title FROM tracks t JOIN release_tracks rt ON rt.track_id = t.id JOIN releases r ON r.id = rt.release_id WHERE r.slug LIKE 'queen-%' OR r.slug LIKE 'kovry-%'"],
        text=True,
    )
    for line in track_rows.splitlines():
        uuid, album, title = line.split("\t")
        rel = by_title[album]
        paint_cover(UPLOADS / "track" / uuid / "cover.jpg", title, album, rel["color"], rel["accent"])
        dest = UPLOADS / "track" / uuid / "audio.mp3"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(AUDIO_SRC, dest)

    for _name, _slug, _voice, _bio, uuid, color in ARTISTS:
        paint_avatar(UPLOADS / "artist" / uuid / "avatar.jpg", color)

    ids = subprocess.check_output(
        MYSQL + ["-N", "-e", "SELECT id FROM releases WHERE is_published = 1 AND (slug LIKE 'queen-%' OR slug LIKE 'kovry-%') ORDER BY id"],
        text=True,
    ).split()
    for rid in ids:
        body = subprocess.check_output(
            ["curl", "-sf", "-H", "X-API-Key: 12345", f"http://127.0.0.1:8080/api/admin/generate_album?id={rid}"],
            text=True,
        )
        print(rid, body.strip())

    print("готово", len(ids), "спектаклей")


if __name__ == "__main__":
    main()
