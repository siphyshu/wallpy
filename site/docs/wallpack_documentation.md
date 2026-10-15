### Wallpack Overview

A "wallpack" is a self-contained directory that bundles a collection of wallpapers with a schedule that dictates when each wallpaper should be displayed. The entire logic is defined in a single `schedule.toml` file within the pack's root directory.

---

### 1. Directory Structure

A valid wallpack must adhere to the following directory structure:

```
my-awesome-pack/
├── schedule.toml
└── images/
    ├── image1.jpg
    ├── image2.png
    └── ...
```

-   **Root Folder (`my-awesome-pack/`):** The main container for the pack. The name of this folder is often used as the default name for the pack.
-   **`schedule.toml`:** (Required) A TOML file that defines the metadata and the display schedule for the wallpapers.
-   **`images/`:** (Required) A directory containing all the wallpaper image files. The filenames listed in `schedule.toml` are relative to this directory.

---

### 2. The `schedule.toml` File

This is the core of the wallpack. It consists of two main parts: a `[meta]` section and a schedule definition section, which can be either `[timeblocks]` or `[days]`.

#### 2.1. Metadata Section: `[meta]`

This section contains general information about the pack.

| Key           | Type   | Required? | Description                                                              |
| :------------ | :----- | :-------- | :----------------------------------------------------------------------- |
| `name`        | String | Yes       | The display name of the wallpack.                                        |
| `type`        | String | Yes       | The type of schedule. Must be either `"timeblocks"` or `"days"`.         |
| `author`      | String | No        | The name of the person who created the pack.                             |
| `description` | String | No        | A brief description of the wallpack's theme or content.                  |
| `version`     | String | No        | The version of the pack, e.g., `"1.0"`. Defaults to `"1.0"`.             |

**Example `[meta]` section:**

```toml
[meta]
name = "Zelda Wind Waker"
type = "timeblocks"
author = "Siphyshu"
description = "A pack that follows the day/night cycle of The Legend of Zelda: The Wind Waker."
version = "1.1"
```

#### 2.2. Schedule Type 1: Time-based (`type = "timeblocks"`)

This schedule type, which can be thought of as a **"Daypack"**, changes wallpapers based on the time of day. It is defined in a `[timeblocks]` table.

-   The `[timeblocks]` table contains one or more sub-tables, where each sub-table represents a distinct period of the day (e.g., `[timeblocks.morning]`).
-   Each timeblock must have a `start` time, an `end` time, and a list of `images`.

**Timeblock Fields:**

| Key       | Type          | Required? | Description                                                                                                                                                           |
| :-------- | :--------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`     | String        | Yes       | The start time of the block. See **Time Specification Format** below.                                                                                                 |
| `end`       | String        | Yes       | The end time of the block. See **Time Specification Format** below.                                                                                                   |
| `images`    | Array of Strings | Yes       | A list of image filenames (e.g., `["image1.jpg", "image2.png"]`). If multiple images are provided, the duration of the timeblock is divided equally among them. |
| `shuffle`   | Boolean       | No        | If `true`, the images for this block will be displayed in a random order. Defaults to `false`.                                                                       |

**Time Specification Format:**

Times can be defined in two ways, and they can be mixed within the same schedule:

1.  **Absolute Time:** A fixed time on the clock.
    -   **Format:** `"HH:MM"` (24-hour format).
    -   **Example:** `"09:00"`, `"22:30"`

2.  **Solar Time:** A time relative to a solar event (sunrise, sunset, etc.). This requires the user to have configured their location in the `wallpy` application.
    -   **Format:** `"event[+/-]offsetm"`
    -   **Supported Events:** `sunrise`, `sunset`, `dawn`, `dusk`, `noon`, `midnight`.
    -   **Offset:** An optional number of minutes to add (`+`) or subtract (`-`) from the solar event. **The `m` for minutes is optional but recommended for clarity. Offsets in hours (`h`) are not supported.**
    -   **Examples:**
        -   `"sunrise"` (the exact time of sunrise)
        -   `"sunset+30m"` (30 minutes after sunset)
        -   `"noon-15m"` (15 minutes before noon)

**Full `timeblocks` Example:**

```toml
# schedule.toml

[meta]
name = "Solar Day Cycle"
type = "timeblocks"

[timeblocks.dawn]
start = "dawn"
end = "sunrise+30m"
images = ["dawn.png"]

[timeblocks.morning]
start = "sunrise+30m"
end = "12:00"
images = ["morning1.jpg", "morning2.jpg"]
shuffle = true

[timeblocks.afternoon]
start = "12:00"
end = "sunset-30m"
images = ["afternoon.jpg"]

[timeblocks.dusk]
start = "sunset-30m"
end = "sunset+45m"
images = ["dusk.png"]

[timeblocks.night]
start = "sunset+45m"
end = "dawn"
images = ["night.jpg"]
```

---

#### 2.3. Schedule Type 2: Day-based (`type = "days"`)

This schedule type, which can be thought of as a **"Weekpack"**, changes wallpapers based on the day of the week. It is defined in a `[days]` table.

-   The `[days]` table contains sub-tables where each sub-table's name is a lowercase day of the week (e.g., `[days.monday]`).
-   You do not need to specify all seven days.
-   Each day entry must have a list of `images`.

**Day Schedule Fields:**

| Key     | Type             | Required? | Description                                                                                                                                                           |
| :------ | :--------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`  | Array of Strings | Yes       | A list of image filenames. If multiple images are provided, the 24-hour duration of the day is divided equally among them.                                             |
| `shuffle` | Boolean          | No        | If `true`, the images for this day will be displayed in a random order. Defaults to `false`.                                                                          |

**Valid Day Names:** `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`.

**Full `days` Example:**

```toml
# schedule.toml

[meta]
name = "Weekly Schedule"
type = "days"

[days.monday]
images = ["work-motivation.png"]

[days.tuesday]
images = ["work-motivation.png"]

[days.wednesday]
images = ["work-motivation.png"]

[days.thursday]
images = ["work-motivation.png"]

[days.friday]
images = ["tgif.jpg"]

[days.saturday]
images = ["weekend-adventure1.jpg", "weekend-adventure2.jpg"]
shuffle = true

[days.sunday]
images = ["relaxing-sunday.png"]
```

---

### 3. Image Constraints and Recommendations

For an online creator, it's important to guide the user on providing suitable images:

-   **Format:** Only `.jpg`, `.jpeg`, and `.png` are officially supported and validated.
-   **Location:** All images must be placed inside the `images/` subdirectory.
-   **Resolution:** A minimum resolution of 800x600 is recommended. The validator will produce a warning for smaller images.
-   **File Size:** The validator warns about very large files (>10MB) as they might impact performance. An online creator could offer to optimize large images upon upload.
-   **Aspect Ratio:** The validator warns about unusual aspect ratios (e.g., very tall or very wide images) that may not fit well on standard monitors.
