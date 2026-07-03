# Changelog

## v0.1.1

Public open beta compatibility and usability update.

### Added

* Added `ps2dvd` executable alias for DVD-first drag-and-drop workflows.
* Added `ps2dvd-ntsc` and `ps2dvd-pal` executable-name presets for generated `SYSTEM.CNF` defaults.
* Added single-ELF drag-and-drop flow with virtual `SYSTEM.CNF` generation.
* Added directory build flow support for projects that contain a root boot ELF but no `SYSTEM.CNF`.
* Added `init-cnf` command for writing `SYSTEM.CNF` from a root directory or boot ELF.
* Added flexible boot executable detection for homebrew-oriented ELF names.
* Added flexible Disc ID handling with `--boot-disc-id` override.
* Added compatibility-oriented default layout generation.
* Added `--layout compact|legacy|packed-legacy`, `--compact`, and `--boot-lba <sector>`.
* Added hold behavior through `--hold`, `--pause-on-finish`, and `*-hold` executable aliases.
* Added Windows PE comments, build date, commit metadata, neutral language metadata, and native Large Address Aware linking.
* Added Linux desktop icon packaging through SVG icon metadata.

### Changed

* Improved default drag-and-drop behavior for less technical users.
* Improved generated `SYSTEM.CNF` handling for ELF-only and minimal homebrew projects.
* Improved generated homebrew boot executable naming by using a Disc-ID-style filename.
* Improved Web/WASM behavior to match the CLI flow for ELF-only and minimal project inputs.
* Improved internal layout allocation to reduce unnecessary padding when compatibility layout mode is used.
* Refactored the CLI orchestration layer into focused modules under `src/app/`.

### Fixed

* Fixed arbitrary `.ELF` boot executable naming by avoiding `.elf` suffixes in generated boot filenames.
* Fixed ELF-only builds that failed when the input filename did not already look like a Disc ID.
* Fixed generated fallback Disc ID naming by using `PSCD_000.01` for neutral homebrew-oriented builds.

---

## v0.1.0

Initial public open beta release.

### Added

* Added `ps2cd` CLI.
* Added directory-to-CD `.bin/.cue` output.
* Added directory-to-DVD `.iso` output.
* Added IML sidecar generation.
* Added existing IML input through `from-iml`.
* Added deterministic file ordering.
* Added `ps2cd.order` allocation manifest.
* Added legacy `ps2iml.order` fallback.
* Added optional local boot-logo source handling.
* Added built-in non-proprietary boot-logo fallback.
* Added Web/WASM preview package.
* Added Windows, macOS, Linux, and Android userspace release artifacts.
* Added SHA256 checksum sidecars for release ZIP files.
* Added `SHA256SUMS.txt` for release verification.
* Added tag-based GitHub Release workflow.
* Added Windows PE icon and version metadata when build inputs are available.
* Added root `ps2cd.manifest.json` for project metadata.

### Notes

* This is a public open beta intended for compatibility validation.
* Source publication is planned after beta validation and compatibility feedback.
* Dynamic library artifacts are not included in this release line.
* No proprietary PlayStation assets are included.
* This release is intended for homebrew-oriented workflows.
