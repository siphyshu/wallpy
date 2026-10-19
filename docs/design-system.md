# Design system

How the site looks, in one page. Use the components in `site/components/ui`
instead of retyping classes; if something isn't covered, extend a component
here first.

## Foundations

| | |
|---|---|
| Ground | `#111111` (`bg-background`); the homepage hero is the day-cycle wallpaper |
| Text | white at 100 / 80 / 70 / 50 / 40% for title, body, secondary, hint, placeholder |
| Lines | `border-white/10` (hover `/20`, focus `/40`) |
| Surfaces | glass: `bg-white/5 border-white/10 backdrop-blur-md` (`Card`) |
| Accent | none. Colour only carries meaning: amber = needs attention, red = error or destructive, green = published/good. The pack-page sky strip uses muted sky colours (the CLI's one accent) |
| Type | Instrument Serif for titles and section headings (`font-serif`); Inter for everything else, including the navbar; mono for commands and `schedule.toml` |
| Corners | `rounded-lg` for buttons, fields and cards; `rounded-full` for pills, chips, tabs and the navbar |
| Focus | visible ring on everything interactive: `ring-2 ring-white/40` (buttons) or a brighter border (fields) |

## Page layout

`<Page width>` sets the width, side gutters (16px, 24px from `sm`) and the top
offset (176px, deliberately well clear of the floating navbar). Pick by what the page holds:

| Width | Max | Pages |
|---|---|---|
| `reading` | 768px | docs, notices, sign-in / sign-up / password pages |
| `browse` | 1152px | gallery, moderation, 404 |
| `wide` | 1280px | pack page, profile, upload wizard |

`<PageHeader title description actions>`: centred serif title (48–60px), the
page's caption under it, actions (e.g. tabs) centred below. Keep the existing
captions (Jaiyank's copy). Left-aligned headers were tried and rejected on
2026-10-19. Every page has one,
except the homepage (hero) and the pack page (the pack's name is the title).
Sections inside a page use `<SectionTitle count>`.

## Components

| Component | Use |
|---|---|
| `Button` / `buttonVariants` | `primary` (white): the one main action in an area. `secondary` (`bg-white/10`): everything else. `ghost`: low-emphasis (Cancel, toolbar icons). `danger`: destructive only (Delete, Take down). Sizes `sm` (cards, toolbars), `md` (default), `lg` (hero, wizard nav). Style a `<Link>` with `buttonVariants()` |
| `Pill` | Kinds, categories, counts: `neutral`. States: `amber` (in review, changes requested, report count), `red` (declined, taken down), `green` (published), `outline` (unlisted, draft). Tags are links: `#tag` in a neutral pill |
| `Notice` | Page- or object-level messages, full width of the content column. `amber` for "waiting for review / changes requested", `red` for errors and takedowns, `neutral` for information. One optional `action` |
| `Card` | Sets one object apart (a pack card, a form, a queue item). Don't nest cards |
| `Input`, `Textarea`, `fieldClasses` | One field style everywhere; labels via `<Label htmlFor>` (every field has one) |
| `LinkTabs` | Segmented tabs where each tab is a URL (moderation) |

## Writing

Name things the way people see them: a **pack** or **wallpack** (both are
used; the wizard is "Create wallpack"), **images**, the **schedule**. Buttons say what happens ("Upload pack", "Send back with
note"). Errors say what's wrong and how to fix it. Sentence case everywhere
except the wordmark.

## Don't

- New colours for decoration (blue badges, purple icons). Use a `Pill` tone or nothing.
- Retyped button or pill classes; extend the component instead.
- A second primary button in the same area.
- Hiding content that's still useful while something else is invalid (keep the last good state, say it's stale).
