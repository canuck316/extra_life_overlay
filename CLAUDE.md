# Extra Life Overlay

Streaming overlay webpage for the Extra Life 24-hour gaming fundraiser. Runs as an OBS Browser Source. Displays donation data, game schedule, and Dixper effect menus to viewers.

## Tech Stack

Vanilla HTML, CSS, and JavaScript only. No frameworks, no build tools, no dependencies.
See `tech.md` for architecture and technical decisions.
See `features.md` for full feature specifications.

## File Structure

```
/assets/        Extra Life official images and .webm video files
/js/
  main.js       Init and orchestration
  schedule.js   Schedule logic (current/next game from system clock)
  donations.js  Extra Life API polling and display
  widgets.js    Timed widget rotation engine
  dixper.js     Dixper menu data and skill suggestion display
config.js       Single user-edited config (IDs, schedule, Dixper skills, timing)
overlay.html    Entry point
styles.css      All layout and animation styles
```

## Running

Serve with any static HTTP server (e.g. `npx serve .` or `python -m http.server 8080`), then point an OBS Browser Source at `http://localhost:8080/overlay.html`. Canvas is 1920×1080.

## External APIs

- **Extra Life / DonorDrive**: `https://extralife.donordrive.com/api/` — public REST, no auth. Polling only. Pass `?version=1.6`.
- **Dixper**: Display-only. Dixper runs its own OBS browser source for effect execution; this overlay shows the menu/skill suggestions as a viewer-facing reference.

## Configuration

All event-specific data lives in `config.js` — participant/team IDs, game schedule with time slots, Dixper menu, per-game skill suggestions, widget timing intervals, which side of the canvas the widgets sit on, and the donation alert's on/off switch, sound file and volume. Edit this file each year before the event.
