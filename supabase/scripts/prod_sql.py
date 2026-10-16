#!/usr/bin/env python3
"""Run SQL on the production database through the Supabase Management API.

`supabase db dump` / direct connections fail on this restored project, so this
is how migrations reach production.

  supabase/scripts/prod_sql.py query "select count(*) from public.packs"   # read-only
  supabase/scripts/prod_sql.py migrate supabase/migrations/<file>.sql       # apply + record
  supabase/scripts/prod_sql.py status                                       # applied migrations

The token is the Supabase CLI's (`supabase login`): ~/.supabase/access-token or
the macOS keychain. It never needs to be pasted anywhere.
"""
import json, pathlib, subprocess, sys, urllib.error, urllib.request

REF = "tblvogsucpzuqbhcvwba"


def token() -> str:
    f = pathlib.Path.home() / ".supabase" / "access-token"
    if f.exists():
        return f.read_text().strip()
    out = subprocess.run(["security", "find-generic-password", "-s", "Supabase CLI", "-w"], capture_output=True, text=True)
    if out.returncode:
        sys.exit("No Supabase CLI token: run `supabase login`.")
    return out.stdout.strip()


def run(sql: str, read_only: bool = False):
    body = {"query": sql, **({"read_only": True} if read_only else {})}
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json", "User-Agent": "wallpy-prod-sql"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:1500]}")


def main():
    cmd, *args = sys.argv[1:] or ["status"]
    if cmd == "query":
        print(json.dumps(run(args[0], read_only=True), indent=2))
    elif cmd == "status":
        for r in run("select version, name from supabase_migrations.schema_migrations order by version", read_only=True):
            print(r["version"], r["name"])
    elif cmd == "migrate":
        path = pathlib.Path(args[0])
        version, name = path.stem.split("_", 1)
        if run(f"select 1 from supabase_migrations.schema_migrations where version = '{version}'", read_only=True):
            sys.exit(f"{path.name} is already applied.")
        sql = path.read_text()
        # One transaction: the migration and its record land together or not at all.
        run(f"begin;\n{sql}\ninsert into supabase_migrations.schema_migrations (version, name, statements) "
            f"values ('{version}', '{name}', array[$wallpy_m${sql}$wallpy_m$]);\ncommit;")
        print(f"applied {path.name}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
