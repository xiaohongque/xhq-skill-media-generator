# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-08-11

First tagged release.

### Added

- **Seedance 2.5 video generation** via the `video.seedance-2.5` provider group key.
  - Documented in `SKILL.md`, `SKILL.zh-CN.md`, `references/catalog.md`, and
    `references/catalog.zh-CN.md`.
  - Added runnable `scripts/run_task.js` examples for `video.seedance-2.5` to both
    `README.md` and `README.zh-CN.md`.
  - `video.seedance-2.5` `resolution` is constrained to `480p` and `720p` only
    (noted in the catalog and examples).

### Changed

- Catalogs now list `video.seedance-2.5` alongside the existing `video.seedance-2.0`,
  `video.seedance-fast-2.0`, `video.seedance-mini-2.0`, `video.grok-image-1.5`,
  `image.gpt-image-2`, and `image.banana` providers.

[0.9.0]: https://github.com/xiaohongque/xhq-skill-media-generator/releases/tag/v0.9.0
