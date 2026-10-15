"""Load the four packs recovered after the S3 buckets were deleted into data model v2.

Uploads every image (plus generated thumbnails/previews and profile/artist
avatars) to R2 under content-addressed keys, then writes the SQL that creates
the matching artists, blobs, pack_versions, version_files and moderation rows.
Run the SQL with any Postgres client (it is one transaction and idempotent
enough to re-run on a fresh v2 database).

    python supabase/seed/load_recovered_packs.py \
        --recovered _src/recovered --profiles profiles.json \
        --sql out.sql [--upload]

profiles.json maps username -> profile id (avatar keys embed the id).
R2 credentials come from site/.env.local (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).
Without --upload nothing leaves the machine.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

import blurhash
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BUCKET = "wallpy-public"
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

# What v1 knew about each pack (supabase/seed/v1_pack_metadata.json), plus the
# fixes made while recovering it.
PACKS = {
    "zelda-wind-waker": dict(
        v1_slug="zelda-wind-walker", images="zelda-wind-waker/images", cover="morning1.jpg",
        title="Zelda Wind Waker", artist="Matt Vince", approved=True),
    "tokyo-street": dict(
        v1_slug="tokyo-street-mj32fzzl", images="tokyo-street/full", cover="day.jpg",
        artist="ArseniXC", approved=True),
    "ocean-hours": dict(
        v1_slug="ocean-hours-mj3csy5s", images="ocean-hours/full", cover="morning.png",
        uploader_is_artist=True, approved=True),
    # Was unpublished in v1; its schedule had to be rewritten, so it waits for review.
    "greasy-diner": dict(
        v1_slug="greasy-diner", images="greasy-diner/full", cover="morning.jpg",
        uploader_is_artist=True, approved=False),
}
ARTISTS = {
    "Matt Vince": dict(url="https://mattvince.com", avatar="site/public/artists/mattvince.png"),
    "ArseniXC": dict(url="https://www.deviantart.com/arsenixc", avatar="site/public/artists/arsenixc.jpg"),
}
AVATARS = {  # username -> (avatar, cover); paths relative to --recovered
    "siphyshu": ("avatars/siphyshu-avatar.jpg", "ocean-hours/full/noon.png"),
    "jaiyank_": ("avatars/jaiyank_-avatar.jpg", None),
}
OWNER = "siphyshu"
THUMB_WIDTH, PREVIEW_WIDTH = 640, 1920


@dataclass
class Blob:
    data: bytes
    mime: str
    width: int
    height: int
    blurhash: str
    sha256: str = field(init=False)

    def __post_init__(self):
        self.sha256 = hashlib.sha256(self.data).hexdigest()


def measure(data: bytes, mime: str) -> Blob:
    with Image.open(io.BytesIO(data)) as im:
        width, height = im.size
        small = im.convert("RGB")
        small.thumbnail((64, 64))
        buf = io.BytesIO()
        small.save(buf, "PNG")
    buf.seek(0)
    return Blob(data, mime, width, height, blurhash.encode(buf, x_components=4, y_components=3))


def rendition(src: bytes, width: int) -> Blob:
    with Image.open(io.BytesIO(src)) as im:
        im = im.convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=82, method=6)
    return measure(buf.getvalue(), "image/webp")


def schedule_images(schedule: dict) -> list[str]:
    seen = []
    for section in ("timeblocks", "days"):
        for block in schedule.get(section, {}).values():
            seen += block["images"]
    seen += schedule.get("album", {}).get("images", [])
    return list(dict.fromkeys(seen))


def q(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    return "'" + str(v).replace("'", "''") + "'"


def r2_client():
    import boto3
    env = {}
    for line in (ROOT / "site/.env.local").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return boto3.client("s3", endpoint_url=env["R2_ENDPOINT"], region_name="auto",
                        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
                        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"])


def upload(r2, key: str, blob: Blob):
    from botocore.exceptions import ClientError
    try:
        if r2.head_object(Bucket=BUCKET, Key=key)["ETag"].strip('"') == hashlib.md5(blob.data).hexdigest():
            return "exists"
    except ClientError:
        pass
    r2.put_object(
        Bucket=BUCKET, Key=key, Body=blob.data, ContentType=blob.mime,
        CacheControl="public, max-age=31536000, immutable",
        ContentMD5=base64.b64encode(hashlib.md5(blob.data).digest()).decode(),
        ChecksumSHA256=base64.b64encode(bytes.fromhex(blob.sha256)).decode(),
    )
    return "uploaded"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recovered", type=Path, required=True)
    ap.add_argument("--profiles", type=Path, required=True)
    ap.add_argument("--sql", type=Path, required=True)
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args()

    profiles = json.loads(args.profiles.read_text())
    v1 = {p["slug"]: p for p in json.loads((ROOT / "supabase/seed/v1_pack_metadata.json").read_text())}
    r2 = r2_client() if args.upload else None
    blobs: dict[str, Blob] = {}
    keys: list[tuple[str, Blob]] = []

    def keep(blob: Blob, key: str | None = None) -> Blob:
        blobs.setdefault(blob.sha256, blob)
        keys.append((key or f"blobs/{blob.sha256}", blob))
        return blob

    sql = ["begin;", "set constraints all deferred;"]

    for name, a in ARTISTS.items():
        avatar = measure((ROOT / a["avatar"]).read_bytes(), MIME[Path(a["avatar"]).suffix])
        ext = Path(a["avatar"]).suffix.lstrip(".")
        key = f"artists/{avatar.sha256}.{ext}"
        keys.append((key, avatar))
        sql.append(f"insert into public.artists (name, url, avatar_key) values ({q(name)}, {q(a['url'])}, {q(key)}) "
                   f"on conflict (lower(name)) do nothing;")

    pack_sql = []
    for slug, p in PACKS.items():
        meta = v1[p["v1_slug"]]
        schedule = tomllib.loads((ROOT / f"spec/examples/{slug}.schedule.toml").read_text())
        files = schedule_images(schedule)
        folder = args.recovered / p["images"]
        unused = sorted({f.name for f in folder.iterdir()} - set(files))
        if unused:
            print(f"  {slug}: not referenced by its schedule, left out (kept in the R2 backup): {', '.join(unused)}")

        entries = []
        for i, fname in enumerate(files):
            path = folder / fname
            blob = keep(measure(path.read_bytes(), MIME[path.suffix.lower()]))
            entries.append((fname, blob.sha256, i))
        cover = blobs[dict((f, s) for f, s, _ in entries)[p["cover"]]]
        thumb = keep(rendition(cover.data, THUMB_WIDTH))
        preview = keep(rendition(cover.data, PREVIEW_WIDTH))

        tags = [t.strip().lower().replace(" ", "-") for t in (meta.get("tags") or [])]
        v = f"(select id from public.pack_versions where pack_id = (select id from public.packs where slug = {q(slug)}) and number = 1)"
        artist = f"(select id from public.artists where lower(name) = lower({q(p['artist'])}))" if p.get("artist") else "null"
        status = "approved" if p["approved"] else "pending"
        owner = f"(select id from public.profiles where username = {q(OWNER)})"
        pack_sql += [
            f"-- {slug}: {len(entries)} images",
            f"insert into public.pack_versions (pack_id, status, title, description, tags, kind, schedule, "
            f"thumb_sha256, preview_sha256, artist_id, uploader_is_artist, license, created_by, submitted_at"
            f"{', reviewed_at, reviewed_by' if p['approved'] else ''}) values ("
            f"(select id from public.packs where slug = {q(slug)}), {q(status)}, {q(p.get('title', meta['title']))}, "
            f"{q(meta.get('description') or None)}, {q('{' + ','.join(tags) + '}')}, {q(schedule['meta']['type'])}, "
            f"{q(json.dumps(schedule))}::jsonb, {q(thumb.sha256)}, {q(preview.sha256)}, {artist}, "
            f"{q(p.get('uploader_is_artist', False))}, 'personal-use', {owner}, now()"
            f"{', now(), ' + owner if p['approved'] else ''});",
        ]
        pack_sql += [f"insert into public.version_files (version_id, path, sha256, sort_order) values ({v}, {q(f)}, {q(s)}, {i});"
                     for f, s, i in entries]
        pack_sql += [
            f"update public.pack_versions set cover_file_id = (select id from public.version_files "
            f"where version_id = {v} and path = {q(p['cover'])}) where id = {v};",
            f"insert into public.moderation_events (version_id, actor_id, action, notes) values "
            f"({v}, {owner}, 'submit', 'migrated from v1');",
        ]
        if p["approved"]:
            pack_sql += [
                f"insert into public.moderation_events (version_id, actor_id, action, notes) values "
                f"({v}, {owner}, 'approve', 'migrated from v1 (was published)');",
                f"update public.packs set current_version_id = {v} where slug = {q(slug)};",
            ]

    profile_sql = []
    for username, (avatar_rel, cover_rel) in AVATARS.items():
        uid = profiles[username]
        sets = []
        for col, rel in (("avatar_key", avatar_rel), ("cover_key", cover_rel)):
            if rel:
                path = args.recovered / rel
                b = measure(path.read_bytes(), MIME[path.suffix.lower()])
                key = f"profiles/{uid}/{b.sha256}.{path.suffix.lower().lstrip('.').replace('jpeg', 'jpg')}"
                keys.append((key, b))
                sets.append(f"{col} = {q(key)}")
        profile_sql.append(f"update public.profiles set {', '.join(sets)} where username = {q(username)};")

    sql += [
        "insert into public.blobs (sha256, size, mime, width, height, blurhash, uploaded_by) values",
        ",\n".join(f"  ({q(b.sha256)}, {len(b.data)}, {q(b.mime)}, {b.width}, {b.height}, {q(b.blurhash)}, "
                   f"(select id from public.profiles where username = {q(OWNER)}))" for b in blobs.values())
        + "\non conflict (sha256) do nothing;",
        *pack_sql,
        *profile_sql,
        f"update public.profiles set role = 'admin' where username = {q(OWNER)};",
        "commit;",
    ]
    args.sql.write_text("\n".join(sql) + "\n")
    print(f"wrote {args.sql}: {len(blobs)} blobs, {len(PACKS)} packs, {len(ARTISTS)} artists")

    if r2:
        results = {"uploaded": 0, "exists": 0}
        for key, blob in keys:
            results[upload(r2, key, blob)] += 1
        print(f"R2 {BUCKET}: {results['uploaded']} uploaded, {results['exists']} already there")
        # verify: every key exists with the exact bytes (ETag of a single PUT is its MD5)
        bad = [k for k, b in keys
               if r2.head_object(Bucket=BUCKET, Key=k)["ETag"].strip('"') != hashlib.md5(b.data).hexdigest()]
        print(f"R2 {BUCKET}: {len(keys)} objects in place, {len(bad)} mismatched {bad[:3]}")


if __name__ == "__main__":
    main()
