# Roadmap

Where Wallpy is and what's next. **Update this at the end of every piece of
work** (tick it off, add what you found). Decisions go in
[decisions.md](decisions.md); how-tos in [operations.md](operations.md).

Last updated: 2026-10-17 (CLI feature-complete; site next)

## Goal

Ship the site (wallpy.siphyshu.me), tested end to end, and a Go CLI
(single binary via brew / winget / apt) that installs packs from it.

## Done

- [x] Diagnosis, security lockdown, monorepo (`cli/ site/ spec/ supabase/`)
- [x] Storage on Cloudflare R2 (`wallpy-public`, served from `wallpy-cdn.siphyshu.me`); Supabase for DB + auth
- [x] Data model v2 ([schema-design.md](schema-design.md)): versions, content-addressed blobs, moderation state machine
- [x] Pack format spec 2 ([../spec/README.md](../spec/README.md)): reference implementation, 23 test vectors, TS port in `site/lib/spec`
- [x] Site on Next 16 + strict TypeScript, types generated from the live schema
- [x] AI-use disclosure (none / assisted / generated); credit stays "by <name>"
- [x] Upload: hash-pinned presigned PUTs, proof-of-upload tickets, atomic `create_pack`
- [x] Review queue: approve, request changes (with a note), decline (final, new packs only)
- [x] New versions: `/packs/<slug>/edit` for changes after review and for updates; existing images reused
- [x] Owners can delete declined packs from their profile
- [x] Production cleaned of test data (2026-10-18); sample packs in [../samples](../samples)
- [x] Builders on the v2 slot model (2026-10-18): state is spec 2 slots; v1 removed from the site; Daypack start-time picker + per-block "change images"; Weekpack day groups with presets; Album custom interval; "Edit as text" for anything the builders can't show; e2e for Daypack + Weekpack (`test:e2e:builders`)

## Now: the site

The CLI is feature-complete; it gets published once the site is
feature-complete too (the CLI downloads from wallpy.siphyshu.me, which isn't
live yet). Next: walk the site's user flows end to end with Jaiyank, then
design and feature work. Collected so far:

- [ ] Walk every user flow end to end (visitor, creator, moderator) and list what's missing or rough
- [x] CLI docs on the site: `/docs` (install per OS, get started, commands, how it works, uninstall, make a pack), checked against the CLI code; content kept in step with cli/README.md
- [x] Install section on the homepage: 3 steps (install with OS tabs, run `wallpy`, done) at `#install`; commands from `site/lib/install.ts`
- [x] Pack pages say `wallpy download <slug>` (components/packs/InstallCommand.tsx): use `wallpy use <slug>`
- [x] Decide: can creators upload a ready-made pack folder or zip (schedule.toml + images)? Today only the builders (2026-10-17: yes — a folder or .zip with schedule.toml + images, parsed and validated against the spec on step 1)
- [ ] Design pass across the site: see "Design pass (in progress)" below

Walkthrough findings (2026-10-17):

Visitor (home, gallery, pack page, profile)
- [x] Navbar "Docs" links to `/docs`, which 404s
- [x] Hero "Install Wallpy →" links to PyPI (the retired Python CLI); pack pages' "Install it first" links to `/#install`, but `<InstallSection />` is commented out in `app/page.tsx`
- [x] No navigation on phones: the navbar hides Docs/Gallery/Github below `md` and there's no menu button (`isMobileMenuOpen` is never used). Now a menu button and a glass menu below `md`, with the account items when signed in
- [x] (2026-10-17: 10 curated categories on the version, 1–2 required, enum-checked in the DB; tags normalised, deduped and autocompleted from public packs) Gallery categories are a fixed list (`GalleryFilters.tsx`) but tags are free text, so chips only match exact tags: Zelda shows under Gaming only because its creator happened to type `gaming`; Ocean Hours isn't under Nature. Either pick tags from the category list at upload, or build the chips from tags in use
- [x] (2026-10-17: `?q=&category=&tag=&sort=&ai=hide&page=`, back/forward work; `?tag=` shows a removable pill) Gallery search, category and sort aren't in the URL (only `?tag=` on first load): back button and shared links lose them
- [x] (2026-10-17: dropdown z-40) Sort dropdown renders under the cards' "AI-generated" badge (z-index)
- [x] (2026-10-17: every image gets a 640px thumbnail and 1920px preview WebP at upload, `version_files.thumb_sha256`/`preview_sha256`; production packs backfilled) Pack page images are slow: only the cover gets a thumb/preview at upload (gallery cards are 20–60 KB, fine), so `PackImageGallery` runs every ~4 MB original through the Next optimizer; thumbnails sit blank on first view. Make a small preview for every image at upload
- [x] (2026-10-17: `PackSchedule`: Daypack 24h strip + blocks with a now marker, Weekpack days with today, Album order + interval; images open in the viewer) Pack page doesn't show the schedule, which is the point of a dynamic pack: what shows when (dawn → morning → dusk → night), ideally with a "now" marker like the CLI's sky strip
- [x] (2026-10-17: pill on the card image) Gallery cards don't say what kind of pack it is (Daypack / Weekpack / Album)
- [x] (2026-10-17: hidden at 0 on cards and the pack page) Download counts show 0 everywhere; consider hiding at 0
- [x] 404 page is Next's default (black, unstyled). Now `app/not-found.tsx` (glass card, gallery/home); pack, profile and moderation 404s use it
- [x] (2026-10-17: transparent at the top, `bg-black/40` + blur once scrolled, every page) The floating navbar has no fill (blur only), so on the homepage gallery its links sit on top of card titles while scrolling. Needs a choice: a dark tint (`bg-black/40`), hide on scroll down, or leave it
- [x] Profile "Contact Email" field is public but only labelled "(optional)"; say it's shown on the profile (2026-10-17: "Shown publicly on your profile.")
- [x] Profile shows "Published" status badges to visitors (only the owner needs them) (2026-10-17; visitors with no packs also no longer see "Upload your first pack")
- Fine: favourite while signed out → login with `?redirect=` back; `/upload` and `/edit` redirect to login; `/moderation` 404s for non-moderators; ZIP builds in the browser with hash checks and progress; CDN CORS allows localhost

Accounts (sign-up, login, reset; read through, not submitted: they hit production)
- [x] Sign-up doesn't check the username: the DB requires `^[a-z0-9_]{3,30}$` and uniqueness (`handle_new_user` trigger), so "John Doe", "jd" or a taken name fail with Supabase's generic "Database error saving new user". Validate inline, check availability, and show the rule (2026-10-17: `lib/username.ts`; lowercased as typed, rule/problem/"Available" under the field, availability via the public `profiles` select, the generic error mapped to a username message)
- [x] After the email code, sign-up goes to `/gallery`, dropping any `?redirect=` (e.g. a visitor who hit Upload); a new creator also lands with an empty profile and no nudge to fill it in (2026-10-17: `?redirect=` honoured via `safeRedirectPath` and carried across the login ↔ sign-up links; an amber "Fill in your profile" notice on your own profile while avatar and bio are empty)
- Fine: password reset (tested by Jaiyank)
- [x] Auth pages all have the generic site title ("Wallpy - Dynamic Wallpapers for your desktop") (2026-10-17: sign in, sign up, reset/choose password, check your email, error. The homepage keeps the site title; `/auth/sign-out` renders nothing)

Creator (from the e2e suites' screenshots: ui, builders, versions; 75/75 checks passed)
- [x] Wizard uses blue steps/Next and a green-ish "Upload Wallpack", not the design system (white primary, `bg-white/10` secondary) (2026-10-17: step circles/lines, Next, Upload Wallpack, Choose Files, type-selector highlights and the Configuration Guide's blue/green icons moved to white/neutral; builder previews, success/error text and the orange/purple guide icons kept their colour)
- [x] Wizard state is only in memory: a refresh or a stray link loses everything, with no "leave page?" warning (2026-10-17: draft in localStorage — type, metadata, schedule config, cover and step — keyed by slug when editing; `beforeunload` warns while there's unsaved work; "Start over" clears it; cleared after a successful submit)
- [x] Next is disabled on Details with no reason shown (title, tags and the AI question are required; tags is easy to miss) (2026-10-17: a list of what's missing shows under the nav on steps 1–3; schedule step problems already showed in the Schedule Preview)
- [ ] Details come before images; images first would let the cover, title and AI question follow from what was uploaded
- [x] The cover is always the first uploaded image; no way to pick it (2026-10-17: a "Cover" pill on each image in the Upload Files step; editing keeps the existing cover selected; `keepRenditions` still works when it's unchanged)
- [ ] Schedule step leads with the raw `schedule.toml` (a tall, mostly empty code box), an "Upload schedule file" panel and a long Configuration Guide; the builder and preview are what creators need. Collapse the TOML and the guide behind "Advanced"/"Help"
- [ ] Daypack's time blocks scroll inside a fixed-height panel, so blocks below the fold are easy to miss
- [x] Review step shows the pack's size with a download icon ("⬇ 50 KB"), which reads like a download button; tags show as typed (#Test) though they're stored lowercase (2026-10-17: plain text "50 KB, 3 images"; the tags preview already used the normalised, stored form)
- [x] No notifications: creators aren't told (email or in-site) when a pack is approved, sent back or declined; they have to check their profile (2026-10-17: in-site notices -- a dot on the navbar avatar, a `/notices` list of approved/changes requested/declined/taken down/restored with the moderator's note, newest first; opening it marks everything read) No notifications: creators aren't told (email or in-site) when a pack is approved, sent back or declined; they have to check their profile
- [ ] "Waiting for review" doesn't say what happens next or how long it usually takes
- [x] Owners can't unlist or delete a published pack (the DB has `is_listed`; only declined packs can be deleted), or withdraw a version in review (already under Later) (2026-10-17: Unlist/List, Withdraw and Delete on the owner's pack page and profile cards, each confirmed; delete needs the pack name typed. Unlisted packs keep their link and installs. Delete account at the bottom of the profile edit form)
- [x] No upload from a ready-made folder/zip (already listed above) (2026-10-17: drop a folder or a .zip with schedule.toml + images on step 1; parsed, type detected, validated against the spec, title prefilled, then straight to the details step)

Moderator (from the e2e screenshots)
- [x] An update shows only "Update · vN": no diff against the live version (images added/removed, schedule, title/tags/licence changes) (2026-10-17: `lib/moderation/review.ts` `diffVersions`, shown on the queue card)
- [x] The queue card doesn't show the schedule or tags; the moderator has to open the pack page to judge them (2026-10-17: categories, tags and a schedule summary on every card)
- [x] No takedown/restore for published packs, though `moderate()` supports both; no way for visitors to report a pack (2026-10-17: report a pack from its page with a reason + note; `/moderation` Reports tab groups open reports by pack, dismiss or take down; Published tab searches all published packs incl. ownerless ones, take down/restore with a required reason the owner sees on their pack page)
- [x] No moderation history (who approved/declined what, when) (2026-10-17: `ModerationHistory.tsx`, collapsed by default, on the pack page for moderators and on every moderation card)
- [x] Cover on the queue card stretches past 16:9 (flex row overrides `aspect-video`) and crops the image (2026-10-17: `self-start` on the thumb)
- Fine: decline needs a reason; the uploader sees the note; declined packs can't be resubmitted and can be deleted; approve publishes and lists in the gallery; v1 stays live while v2 is in review; a second pending version is refused; unchanged images aren't re-uploaded
Profile editing (walked 2026-10-17 with a throwaway user; now `npm run test:e2e:profile`, 28 checks)
- Fine: name, bio, links, contact email, avatar and cover save, survive a reload and show to signed-out visitors; images land in `profiles/<id>/`
- [x] Fixed: a link without `https://` or a malformed contact email failed the DB check with a raw constraint error; now checked first with a clear message (`lib/profile-fields.ts`), scheme added for bare domains. Link URLs were silently cut at 100 characters (DB allows 300), name at 50 (DB 60). Images over 5 MB only failed on Save; now on picking. "Add Link" was blue; now the `bg-white/10` secondary pill
- [ ] Navbar avatar doesn't update after saving a new one until the page reloads (it loads the profile once on mount)
- [x] No way to remove an avatar or cover once set (only replace); replaced files stay in R2 under `profiles/<id>/` (2026-10-17: remove buttons in the edit form; removed and replaced files are deleted from R2)
- [x] `profiles.website` exists (filled for v1 users) but the profile neither shows nor edits it; links cover the same need (2026-10-17: moved into `links` as "Website", column dropped)
- [ ] With no display name the profile shows an empty heading above `@username` (sign-up asks for a name, so mostly old/test accounts)

Final walk (2026-10-18, after all batches; now `test:e2e:journey`, 15 steps across creator, moderator and visitor, clicking only)
- [x] Signed-out visitors had no way to report (only signed-in saw "Report this pack"); now it links to sign-in and back, like favourites
- [x] Takedown notice ended in a double full stop ("…takedown..")
- [x] The desktop avatar menu stayed open after picking an item
- [x] Wizard details labels weren't linked to their fields (screen readers couldn't name them)
- [ ] A taken-down pack's owner sees the reason and a Delete button, but nothing about what happens next. Decided: final; say so and point to support (GitHub issues + email)

### Design pass (in progress, started 2026-10-19)

Scope (Jaiyank): consistency + polish, done directly in the main thread (no
subagents). Rules: [design-system.md](design-system.md). Contact sheet of every
page (before) and the title comparison: https://claude.ai/artifact/VavD67B2KUoSotfBYsdoX2
(private). Recapture with the scratch scripts in this session's scratchpad
`sheet/capture.mjs` (seeds a creator/moderator/reporter with Harbour Lights
packs in every state, screenshots desktop 1280 + phone 390; `ONLY=role-page,...`
and `OUTDIR=./after/` for a subset; cleans up after itself) and `sheet/montage.mjs`.

Decided: centred page headers (left-aligned tried and rejected); keep the
original captions under titles (only some titles changed: Gallery, Notices,
Moderation, "Create wallpack", Sign in, Create an account); keep the 176px top
spacing and the original wizard progress indicator (circles + step name);
three widths (reading 768 / browse 1152 / wide 1280); "pack" and "wallpack"
both fine; navbar in Inter; takedowns final, support = GitHub issues +
siphyshu@gmail.com; builders' grid layout and the full schedule.toml stay.

Done
- [x] Builder: schedule.toml always editable next to the builder; the builder dims (doesn't hide) when the text can't be shown; the Wallpack Preview keeps the last working schedule (`96f8133`)
- [x] Shared components in `site/components/ui`: Button, Pill, Notice, Card, Input/Textarea, LinkTabs, Page/PageHeader/SectionTitle; `docs/design-system.md` (`c748216`)
- [x] Page headers + widths + new titles on Gallery, Docs, Notices, Moderation, upload wizard (per-step headings now sr-only), sign in / sign up / password pages (`c748216`, centred in `b280dd5`)
- [x] Pack page: `Page wide`, neutral kind pill, category/tag pills, `Notice` (red for takedowns/declines, with "Takedowns are final" + GitHub issues/email), "Your pack" label, owner controls / report form / ZIP on `Button` + fields
- [x] Profile: `Page wide`, status `Pill` tones, `SectionTitle` (titles kept), owner/profile/delete-account buttons and fields on `Button` + `fieldClasses` (no blue focus ring), dusk-gradient empty cover, the nudge is a `Notice` without its own button (Edit Profile sits under it), download count hidden at 0

To do (in order)
- [x] Homepage: "Browse the gallery" / "Read the docs" on `buttonVariants` (hero buttons and copy untouched)
- [x] Footer: Docs, Gallery, GitHub, Report a problem (GitHub issues), siphyshu@gmail.com above the copyright
- [x] Moderation: kind/category/tag/state pills via `Pill`; covers fall back to the title when there's no rendition; review, takedown and search controls on `Button`/`Textarea`/`Input`
- [x] Off-palette colours: what's left carries meaning and stays (green success text, the pack schedule's sky tints, the violet AI label, the pink favourite heart, the builder guide's orange/purple icons kept on 2026-10-17)
- [x] Auth forms already on `Input`/`Button`; 404 buttons and badge on the shared styles (its card layout kept)
- [x] Wizard nav, Choose Files, import buttons and the details fields on `Button`/`fieldClasses`
- [x] Fonts: navbar in Inter (unused Alegreya removed); `site/public/fonts/` (Thunder, Megna trial) deleted
- [x] Docs: contents chips centred under the header

- [ ] Final: typecheck, lint, unit, every e2e suite (incl. `journey`), recapture the whole contact sheet as "after" and republish it for Jaiyank

## Go CLI: feature-complete (publish after the site)

Goal: the CLI should feel delightful, crafted at every touchpoint from install
to everyday use. Stack: Cobra + Fang (commands, help, errors), Lip Gloss (all
output, via `internal/ui`), Huh (prompts), Bubble Tea + Bubbles (interactive
screens). Plain output when piped, `NO_COLOR` respected, the background tick
silent and instant. Check every screen in a light and a dark terminal (VHS).

- [x] Scheduler + validator passing `spec/vectors/vectors.json` (2026-10-17): `cli/internal/spec`; solar maths ported from astral, identical to the second on 3,660 sample times
- [x] Foundation (2026-10-17): Cobra + Fang skeleton (`wallpy`, `--help`, `--version`, completion) and `internal/ui`, the terminal design system: the site's monochrome hierarchy plus one accent, the colour of the sky right now; a 24h sky strip; errors in Wallpy's voice with "did you mean"; adapts to light/dark; plain when piped
Commands (designed fresh, not copied from the Python CLI): `wallpy` (home),
`use <pack|url|folder>` (install if needed, switch, set now, start the service
on first use), `browse`, `show [--at]`, `list`, `get` (alias `download`),
`update`, `remove`, `location`, `pause`/`resume`, `doctor`, `check <folder>`,
hidden `run` for the service.

- [x] `wallpy get <slug|url>` (2026-10-17): manifest → parallel downloads streamed through SHA-256 + size checks → schedule validated against the files → atomic swap; reinstall reuses verified local files (`--force` repairs); Ctrl-C leaves nothing; downloads counted (`?download=cli`) only after a successful install on the real site. Packs live in `library.Home()` (per-OS data dir, `WALLPY_HOME` overrides)
- [x] `wallpy` home screen (2026-10-17): active pack, sky strip on real sun times, today's slots with the current one marked, next change
- [x] `use` (slug, link or folder: installs/imports, sets now, starts the agent), `list`, `show [--at]` (also for gallery packs, without installing), `remove` (asks first), `update` (reuses unchanged images), `check <folder>`, `location` (auto from time zone via embedded zone.tab, city search via Open-Meteo, lat,lon), `pause`/`resume`, `uninstall` (removes the agent, optionally packs and settings, saving the wallpaper on screen; prints the package manager's remove command), `doctor` (wallpaper method, agent, pack hashes, location, last agent error)
- [x] Set wallpaper (2026-10-17): `internal/wallpaper`. macOS via AppKit through purego (no cgo, no AppleScript prompt; main thread only, waits until macOS applies it; checked live with `WALLPY_TEST_DESKTOP=1`). Windows via SystemParametersInfo (compile-checked). Linux/BSD: GNOME, Cinnamon, MATE, KDE, Xfce, LXQt, sway, Hyprland (swww/hyprpaper), feh (selection unit-tested; not yet run on a Linux desktop)
- [x] Background agent (2026-10-17): `wallpy run` sleeps until the next change (waking at least every minute), one at a time via `agent.lock`, logs to `agent.log`; launchd LaunchAgent (tested live), XDG autostart on Linux, Task Scheduler logon task on Windows (both compile-checked)
- [x] `wallpy browse [search]` (2026-10-17): Bubble Tea gallery, previews drawn in half blocks (any colour terminal), `/` filter, Enter installs and uses; plain list when piped
- [x] Guided first run (2026-10-17): first `wallpy` in a terminal asks where you are (time-zone guess first) and opens the gallery; prompts themed from `internal/ui`
- [x] Sharper previews (2026-10-17): Kitty graphics with Unicode placeholders in Ghostty and Kitty (real pixels; half blocks show first, then the image), better half blocks elsewhere (Catmull-Rom resampling, cached per size); `WALLPY_IMAGES=kitty|blocks` overrides detection. Kitty output is unit-tested against the protocol, not yet seen in Ghostty by a person
- [x] Gallery links (2026-10-17): `o` in browse, `wallpy show <pack> --web`, pack titles are OSC 8 links in show/get/list/update/use/home
- [x] `show` draws the pack's picture (2026-10-17): the image on screen now or at `--at`; Kitty graphics or half blocks; fetches one image for gallery packs
- [x] Update notices (2026-10-17): once a day, in the background, GitHub's latest release; one line on stderr with the upgrade command for how wallpy was installed; never for dev builds, the agent, pipes or CI; `WALLPY_NO_UPDATE_CHECK=1`
- Tabled: `wallpy new` (pack creation stays on the site's builders; the CLI keeps `check` and `use ./folder`)
- [x] iTerm2 and Sixel previews (2026-10-17): iTerm2/WezTerm use iTerm2 inline images, foot/Windows Terminal/Konsole/mlterm use Sixel; in browse the box is left blank and the image painted into it; printed images reserve their rows first, so terminals' differing cursor behaviour doesn't matter. Data and placement are unit-tested; not yet seen in those terminals by a person
- [x] GoReleaser config (2026-10-17): `cli/.goreleaser.yaml`, cgo-free builds for macOS/Linux/Windows (amd64, arm64) and FreeBSD, archives with completions + man page, deb/rpm/apk, Homebrew cask, Scoop, winget, AUR; `--snapshot` verified
- [ ] Publish the first release (needs the tap/bucket repos, winget fork, AUR key and tokens: operations.md "Release the CLI")
- [ ] Sign and notarize macOS binaries (Apple Developer ID); sign Windows binaries (SmartScreen)
- [ ] Run on a real Linux desktop (GNOME, KDE, sway) and a real Windows machine: setters and agent are compile-checked and unit-tested only
- [ ] Final PyPI release of the Python CLI pointing at the new installers
- [x] E2E (2026-10-17, by Jaiyank): upload on the site → approve → install with the CLI → wallpaper changes

## Before launch

- [ ] Cloudflare on `wallpy-cdn.siphyshu.me`: Cache Rule (eligible, respect origin TTL) **and** a response-header rule `Access-Control-Allow-Origin: *` (both together; see operations.md)
- [ ] Remove the dev origins `http://localhost:3101`–`3110` from the `wallpy-public` CORS rules (keep `localhost:3000` only if still needed)
- [ ] Swap the temporary admin R2 token `wallpy-admin-setup` for a bucket-scoped `wallpy-site-prod`
- [ ] DNS: `wallpy.siphyshu.me` points at a dead IP; stale `*.siphyshu.me` wildcard
- [ ] Deploy the site (host TBD) with production env vars
- [x] Footer year updated to 2026 (2026-10-17)
- [x] Replace trial / unlicensed fonts (Thunder, Megna trial) (2026-10-19: unused, deleted)
- [ ] Privacy and terms pages, linked from the footer
- [ ] Push the `monorepo` branch (only when asked)

## Later / ideas

- Weekday pills on Daypack blocks (weekend variants of a time block); the format allows it, the builder doesn't (edit schedule.toml directly)
- ~~Withdraw a version that's in review~~ (done 2026-10-17)
- Garbage-collect R2 blobs no version uses (deleting a pack keeps its images)
- Keep moderation history when an owner deletes a declined pack (deleting cascades it today)
