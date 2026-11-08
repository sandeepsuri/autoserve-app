# AutoServe — Book & Go

Approved direction: concept 04, a calendar paired with a car silhouette.

## Assets

- `book-and-go-concept.png`: approved concept board, including the wordmark.
- `book-and-go-master.png`: full-resolution app symbol on navy.
- `book-and-go-icon.png`: 1024 × 1024 app icon.
- `book-and-go-adaptive.png`: 1024 × 1024 Android foreground with padded artwork on navy.
- `book-and-go-splash.png`: 512 × 512 splash image.
- `book-and-go-mark.png`: 256 × 256 welcome-screen image.
- `book-and-go-favicon.png`: 64 × 64 web favicon.

The welcome screen uses `components/AutoServeLogo.tsx` to pair the symbol with
live Plus Jakarta Sans text in the app's blue and orange. Existing asset files
are preserved; `app.json` references the new exports. Native launcher and splash
changes require a new app build. These are raster assets; no vector master is
included.

## Generation

Created with the built-in image generation tool using the approved concept board
as a reference. Final exports are resized from the opaque master. Transparent
drafts were discarded because of edge artifacts.

Final generation prompt:

> Produce a FINAL square app icon of the approved BOOK & GO logo shown on the RIGHT of the reference. NOT a board. One calendar-car mark only on a perfectly uniform solid dark navy #0B1220 background filling the entire square edge-to-edge. No rounded outer square corners (the operating system supplies corners). Center the orange-and-white calendar/car symbol, occupying 56% of canvas width and centered vertically. Match the approved icon faithfully: two orange calendar tabs with white outlines, orange calendar header with slim white base, the white sweeping car roof/hood line and white headlight below. All empty spaces around and inside emblem must be the SAME solid navy #0B1220 background, fully opaque, no transparency. No blue lower calendar rectangle; lower portion is open navy like the approved app icon. No text, labels, mockups, borders, gradients, texture, lighting, shadows, stray marks or extra objects. Precise flat professional logo with crisp smooth edges and generous padding.
