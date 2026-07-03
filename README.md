# ps2cd public open beta

## Index

- [What this release is](#what-this-release-is)
- [What is included](#what-is-included)
- [Integrity files](#integrity-files)
- [No proprietary assets](#no-proprietary-assets)
- [Compatibility feedback](#compatibility-feedback)
- [Source availability](#source-availability)
- [Links](#links)

## What this release is

`ps2cd` v0.1.X is a public open beta for deterministic PS2 CD/DVD image building.

The purpose of this beta is to validate real-world compatibility before locking a broader public development surface.

## What is included

The release line includes:

- CLI builds for Windows, macOS, Linux, and Android userspace.
- A Web/WASM preview package for browser-based workflows.
- Documentation for usage, downloads, architecture, compatibility notes, and developer assets.
- A boot-logo replacement pipeline for local user-provided or developer-provided sources.
- Release checksums for artifact verification.

## Integrity files

Every release ZIP has SHA256 verification data:

```text
SHA256SUMS.txt
*.zip.sha256
```

Use these files to confirm that a downloaded artifact matches the published release.

## No proprietary assets

`ps2cd` does not include proprietary PlayStation assets, extracted boot-logo payloads, or protected logo sector dumps.

Users and project maintainers are responsible for providing their own legally allowed local files when using the tool.

## Compatibility feedback

Useful compatibility reports include:

```text
ps2cd version
platform used to build the image
output type
loader or emulator version
hardware model, when applicable
whether the boot logo appeared correctly
whether the target ELF started correctly
notes about audio, video, or loading behavior
```

## Source availability

This beta is distributed as compiled artifacts and a Web/WASM package first.

Source publication is planned after public beta validation and compatibility feedback. This keeps the initial release focused on testing, artifact quality, documentation, and compatibility reports before the development surface is opened more broadly.

## Links

- [GitHub repository](https://github.com/jonnypaes/ps2cd)
- [GitHub Pages](https://jonnypaes.github.io/ps2cd/)
- [Latest release](https://github.com/jonnypaes/ps2cd/releases/latest)
- [Downloads](https://jonnypaes.github.io/ps2cd/docs/download/)

## Convenience aliases

`ps2cd` can be copied with another executable name to change safe defaults without changing the binary:

- `ps2cd`: CD-first default.
- `ps2dvd`: DVD-first default.
- `ps2dvd-ntsc`: DVD-first default and NTSC for generated `SYSTEM.CNF`.
- `ps2dvd-pal`: DVD-first default and PAL for generated `SYSTEM.CNF`.

These names do not inject arbitrary commands. They only select recognized built-in defaults, and explicit CLI flags take precedence.

A single boot ELF can also be used as input. In that case, `ps2cd` creates a minimal virtual project in memory, generates `SYSTEM.CNF`, and writes the requested image without modifying the source directory.

Directories are handled with the same rule: if `SYSTEM.CNF` exists at the project root, it is used as-is; if it is missing and a root boot ELF can be detected, `ps2cd` generates a temporary `SYSTEM.CNF` for the build. Use `init-cnf` when you want to write the generated `SYSTEM.CNF` to disk.

## Compatibility layout

The default beta layout is `packed-legacy`.

`ps2cd` targets the boot executable at LBA `12231` for compatibility-oriented builds. Before placing the boot executable, it tries to pack real project files into the available pre-boot area. It only leaves generated zero padding for the remaining gap.

Use compact output when size matters more than this compatibility layout:

```bash
ps2cd ./project --compact
ps2dvd ./project --compact
```

Use a manual boot LBA when needed:

```bash
ps2cd ./project --boot-lba 12231
```

## Hold mode

For drag-and-drop users, the Windows build waits before closing when launched in the simple default path mode. You can also force this behavior on any platform with:

```bash
ps2cd ./project --hold
```

or by using a `*-hold` executable alias when available.

### Windows drag-and-drop metadata

Windows builds include PE metadata that describes the drag-and-drop workflow. The executable also links with Large Address Aware enabled for native large-image workflows on supported Windows targets.

### Generated homebrew boot names

When `SYSTEM.CNF` must be generated for an arbitrary `.ELF`, ps2cd creates a virtual Disc-ID-style boot name using the `PSCD_000.01` fallback. Existing `SYSTEM.CNF` files are still respected when building a directory.
