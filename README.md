# ps2cd Web/WASM preview

## Index

- [Purpose](#purpose)
- [Hosted layout](#hosted-layout)
- [User input](#user-input)
- [Developer customization](#developer-customization)
- [Build output](#build-output)

## Purpose

This folder contains the browser UI for the ps2cd Web/WASM preview.

The web package is intentionally simple: it loads user files, applies optional site-level customization, calls the WASM exporter, and downloads the generated output.

## Hosted layout

The app is self-contained under this folder:

```text
web/
  index.html
  boot.bmp              optional site-level boot-logo override
  dist/
    ps2cd.js
    ps2cd_bg.wasm
  src/js/
    app.js
    config.js
  src/css/
    style.css
  assets/
    README.md
```

Open `index.html` through a local or hosted HTTP server. Direct `file://` loading may fail because browser module and WASM loading require HTTP semantics.

## User input

The generic builder expects the uploaded ZIP or selected folder to mirror the intended disc root.

With an existing `SYSTEM.CNF`:

```text
SYSTEM.CNF
SLUS_123.45
DATA/
MODULES/
```

For homebrew-oriented minimal projects, `SYSTEM.CNF` may be omitted when a root boot ELF is present:

```text
BOOT.ELF
DATA/
```

In that case, the Web/WASM builder generates `SYSTEM.CNF` inside the virtual build input and does not modify the uploaded files.

The generic public UI does not ask the user to edit a manifest or choose a boot-logo file.

## Developer customization

A fork can replace `web/boot.bmp` or add files under `web/assets/`.

If `web/boot.bmp` is missing, the Rust/WASM core still has a built-in fallback boot logo embedded at `src/boot_logo/assets/ps2cd_boot.bmp` at compile time. The file is optional and exists to make project customization obvious. If the embedded BMP cannot be parsed, the core generates a small `PS2CD` wordmark at runtime as the final fallback.

## Build output

CD output:

```text
*.bin
*.cue
*.iml
```

DVD output:

```text
*.iso
*.iml
```

## Layout

The Web build is scoped to `web/` and uses `packed-legacy` layout by default. The boot executable is targeted at LBA `12231`, with real files packed before the boot anchor when possible.

Adjust this in `src/js/config.js`:

```js
layout: {
  mode: 'packed-legacy',
  bootLba: 12231
}
```
