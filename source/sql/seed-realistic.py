#!/usr/bin/env python3
# Рисует квадратные обложки и ролики 628×628 для Queen и собирает страницы.
# Программу в базу этот файл не пишет.
# Сначала:
#   mysql -uroot -p --default-character-set=utf8mb4 < source/sql/create.sql
#   mysql -uroot -p --default-character-set=utf8mb4 < source/sql/data.sql
# Затем из корня репозитория:
#   python3 source/sql/seed-realistic.py
#
# Старые файлы посева (uuid a/b/c1111111-…) удаляются.
# Короткий шум зала, которым пользуются тестовые страницы, остаётся.
# Текстов песен и коммерческих записей здесь нет.

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "source"
UPLOADS = SOURCE / "uploads"
ALBUMS = SOURCE / "albums"
AUDIO_SRC = UPLOADS / "track" / "11111111-1111-4111-8111-111111111111" / "audio.mp3"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SIDE = 628
MYSQL = ["mysql", "-uroot", "-p12345", "--default-character-set=utf8mb4", "catalog"]

LOOK = {
    "queen-night-at-the-opera": ((92, 18, 28), (212, 175, 90)),
    "queen-news-of-the-world": ((28, 28, 32), (230, 220, 190)),
    "queen-innuendo": ((18, 22, 48), (180, 170, 210)),
    "queen-the-game": ((48, 28, 18), (220, 160, 90)),
    "queen-a-kind-of-magic": ((24, 18, 48), (190, 150, 210)),
}
ARTIST_COLOR = {
    "freddie-mercury": (180, 40, 50),
    "brian-may": (120, 70, 30),
    "roger-taylor": (70, 80, 120),
    "john-deacon": (40, 70, 80),
}


def sql_rows(query):
    out = subprocess.check_output(MYSQL + ["-N", "-e", query], text=True)
    rows = []
    for line in out.splitlines():
        if line.strip():
            rows.append(line.split("\t"))
    return rows


def paint_cover(path, title, subtitle, color, accent):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (SIDE, SIDE), color)
    draw = ImageDraw.Draw(img)
    margin = 36
    draw.rectangle((margin, margin, SIDE - margin, SIDE - margin), outline=accent, width=4)
    inner = margin + 18
    draw.rectangle((inner, inner, SIDE - inner, SIDE - inner), outline=accent, width=2)
    title_font = ImageFont.truetype(FONT, 46)
    sub_font = ImageFont.truetype(FONT_REG, 24)
    lines = []
    current = ""
    for word in title.split():
        trial = (current + " " + word).strip()
        if draw.textlength(trial, font=title_font) < SIDE - 140:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    y = SIDE // 2 - 28 * len(lines)
    for line in lines:
        width = draw.textlength(line, font=title_font)
        draw.text(((SIDE - width) / 2, y), line, font=title_font, fill=accent)
        y += 56
    width = draw.textlength(subtitle, font=sub_font)
    draw.text(((SIDE - width) / 2, y + 16), subtitle, font=sub_font, fill=(235, 228, 214))
    img.save(path, quality=90)


def paint_avatar(path, color):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (SIDE, SIDE), (12, 10, 12))
    draw = ImageDraw.Draw(img)
    pad = 48
    draw.ellipse((pad, pad, SIDE - pad, SIDE - pad), fill=color)
    img.save(path, quality=90)


def paint_video(path, title, color):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = path.with_suffix(".txt")
    text.write_text(title + "\n", encoding="utf-8")
    hex_color = "0x{:02x}{:02x}{:02x}".format(*color)
    filt = (
        f"drawtext=fontfile={FONT}:textfile={text}:fontsize=42:"
        "fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2"
    )
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c={hex_color}:s={SIDE}x{SIDE}:d=2",
            "-vf", filt,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
            "-movflags", "+faststart",
            str(path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    text.unlink(missing_ok=True)


def clean_seed(keep):
    for kind in ("release", "track", "artist"):
        folder = UPLOADS / kind
        if not folder.is_dir():
            continue
        for child in folder.iterdir():
            name = child.name
            if name[:1] in "abc" and name.startswith(name[:1] + "1111111-") and name not in keep:
                shutil.rmtree(child)
    for folder in ALBUMS.glob("kovry-*"):
        shutil.rmtree(folder)


def main():
    if not AUDIO_SRC.is_file():
        raise SystemExit("нет короткого файла шума зала: " + str(AUDIO_SRC))

    releases = sql_rows(
        "SELECT uuid, slug, title, subtitle FROM releases WHERE slug LIKE 'queen-%' ORDER BY sort_order"
    )
    if len(releases) != 5:
        raise SystemExit("в базе должно быть 5 спектаклей Queen, сейчас " + str(len(releases)))

    tracks = sql_rows(
        "SELECT t.uuid, r.slug, r.title, t.title FROM tracks t "
        "JOIN release_tracks rt ON rt.track_id = t.id "
        "JOIN releases r ON r.id = rt.release_id "
        "WHERE r.slug LIKE 'queen-%' ORDER BY r.sort_order, rt.track_number"
    )
    artists = sql_rows(
        "SELECT uuid, slug, name FROM artists WHERE slug IN "
        "('freddie-mercury','brian-may','roger-taylor','john-deacon') ORDER BY sort_order"
    )
    keep = {row[0] for row in releases + tracks + artists}
    clean_seed(keep)

    for uuid, slug, title, subtitle in releases:
        color, accent = LOOK.get(slug, ((40, 20, 24), (212, 175, 90)))
        base = UPLOADS / "release" / uuid
        paint_cover(base / "cover.jpg", title, subtitle, color, accent)
        paint_video(base / "video.mp4", title, color)

    for uuid, slug, album, title in tracks:
        color, accent = LOOK.get(slug, ((40, 20, 24), (212, 175, 90)))
        base = UPLOADS / "track" / uuid
        paint_cover(base / "cover.jpg", title, album, color, accent)
        paint_video(base / "video.mp4", title, color)
        dest = base / "audio.mp3"
        shutil.copy(AUDIO_SRC, dest)

    for uuid, slug, _name in artists:
        paint_avatar(UPLOADS / "artist" / uuid / "avatar.jpg", ARTIST_COLOR.get(slug, (80, 80, 80)))

    ids = [row[0] for row in sql_rows("SELECT id FROM releases WHERE slug LIKE 'queen-%' AND is_published = 1 ORDER BY id")]
    for rid in ids:
        body = subprocess.check_output(
            ["curl", "-sf", "-H", "X-API-Key: 12345", f"http://127.0.0.1:8080/api/admin/generate_album?id={rid}"],
            text=True,
        )
        print(rid, body.strip())
    print("готово", len(ids), "спектаклей")


if __name__ == "__main__":
    main()
