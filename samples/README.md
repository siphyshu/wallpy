# Sample packs

Two small packs for trying the site's workflows by hand. All images are
1920×1080 JPGs made by `node samples/make.mjs`; both schedules are spec 2 and
pass the reference validator.

| Pack | Template | Images | Schedule |
|---|---|---|---|
| `harbour-lights/` | Daypack | dawn, morning, afternoon, sunset, night | dawn → sunrise+1h → noon → sunset−45m → dusk+30m |
| `colour-week/` | Weekpack | mon … sun | one slot per weekday |

`harbour-lights/for-new-version/midnight.jpg` is an extra image for testing updates.

## Workflows to try

1. **Upload.** `/upload` → Daypack → details → drop the five images from
   `harbour-lights/images/` → build the blocks, or use **Upload schedule** with
   `harbour-lights/schedule.toml` → submit. The pack page says it's waiting for review.
2. **Request changes.** As a moderator: account menu → **Review queue** →
   **Request changes** with a note. As the uploader: the pack page shows the note
   and **Make changes**; add `midnight.jpg` to the night block and submit version 2.
3. **Approve.** Back in the queue, **Approve & publish**. The pack appears in the
   gallery and `wallpy download <slug>` / **Download ZIP** work.
4. **Update a published pack.** On the pack page, **Upload a new version**:
   change the title or a block's start time and submit. Version 1 stays live
   until version 2 is approved; the queue marks it **Update · v2**.
5. **Decline.** Upload `colour-week` (Weekpack), then **Decline** it with a
   reason. The uploader is told why and can't resubmit; their profile offers
   **Delete** for it.

To test review with one account, a second (moderator) account helps: set
`profiles.role = 'moderator'` for it in Supabase.
