# Vendored application fonts

These are the existing application font families, self-hosted with `next/font/local`.
They replace only the Google Fonts build-time download in the root layout; CSS
variables, locale direction, normal styles, `display: swap`, and requested weights
remain unchanged.

| Family               | Normal weights     | License                         |
| -------------------- | ------------------ | ------------------------------- |
| IBM Plex Sans        | 400, 500, 600, 700 | [SIL OFL 1.1](OFL-IBM-Plex.txt) |
| IBM Plex Sans Arabic | 400, 500, 600, 700 | [SIL OFL 1.1](OFL-IBM-Plex.txt) |
| Fraunces             | 600, 700           | [SIL OFL 1.1](OFL-Fraunces.txt) |

## Why local assets

The lockfile-pinned Next.js 15.5.22 Google loader extracts a font URL's extension
with an unchecked regular-expression match. A valid extensionless
`fonts.gstatic.com/l/font?kit=...` response produces
`TypeError: Cannot read properties of null (reading '1')`, as documented in
[Next.js issue #99114](https://github.com/vercel/next.js/issues/99114).

The failing PR run and passing push run used the same head commit. The supplied
stack trace matches this installed code path. The failed response body is not
available, so its particular font URL is not claimed to have been captured.
Keeping the original font files in the repository removes this network-dependent
code path without patching Next.js, changing dependencies, or relaxing CI.

## Provenance and integrity

Downloaded on 2026-11-01 directly from the Google Fonts CSS API, requesting the
same family, normal weights and default axes as the original layout. A
`Mozilla/5.0` user agent selects full-character-set static TTF files. This avoids
dropping glyphs by treating separate Unicode subsets as interchangeable local
sources, and preserves the original static optical/width axis choices.

The files are unmodified Google-served font binaries, not regenerated, subsetted,
renamed internally, or replaced with another family. Full TTF files total
1,865,304 bytes before HTTP compression; retain all files when packaging the application.
Do not replace them with a variable font without checking its default axes.

License texts are copied unchanged from Google Fonts repository revision
[`6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec`](https://github.com/google/fonts/tree/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec):
`ofl/ibmplexsans/OFL.txt` (also covers IBM Plex Sans Arabic) and
`ofl/fraunces/OFL.txt`. Retain the notices when redistributing these assets.

| File                           | Original binary                                                                                                                                             | SHA-256                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ibm-plex-sans-400.ttf`        | [Google Fonts v23](https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSD6llzAA.ttf)                          | `6dbe082463cf749cfa057d45c3048c90f4df031496498e5b5bdfd0b6babb9d16` |
| `ibm-plex-sans-500.ttf`        | [Google Fonts v23](https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSD2FlzAA.ttf)                          | `6f7a8c4219e021ff7c9131bc5f1f7af97bcd1436a59578d444a8cb92e9791742` |
| `ibm-plex-sans-600.ttf`        | [Google Fonts v23](https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSDNF5zAA.ttf)                          | `5311c66fd6d04ae45671236f7eae667b671c06c1dc7e88d52c206e5fadd0fb21` |
| `ibm-plex-sans-700.ttf`        | [Google Fonts v23](https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSDDV5zAA.ttf)                          | `e129a20e8ff7c907ffd07124b573e88c323b7b18afc934d4aa539a3e0f2fe100` |
| `ibm-plex-sans-arabic-400.ttf` | [Google Fonts v15](https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6bs6.ttf)                                              | `02609c5ef845ef511676c8badb24d1fc8b4aed3dc3b9d8bbdab22c14431b7c16` |
| `ibm-plex-sans-arabic-500.ttf` | [Google Fonts v15](https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPO_9CT.ttf)                                          | `1fe214ca7ff822ff8b73e5bb9584414bfc6c845e7ddab41f24ac4fce8e55a860` |
| `ibm-plex-sans-arabic-600.ttf` | [Google Fonts v15](https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPi-NCT.ttf)                                          | `9e8b030f3326946e481c874a2f751c1321cb0708cba81b79e6c3f9ffacc931df` |
| `ibm-plex-sans-arabic-700.ttf` | [Google Fonts v15](https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-dCT.ttf)                                          | `05616a64c5dca137a327b30b1fe7f4fcd1e16892a332e1665b49d52038858044` |
| `fraunces-600.ttf`             | [Google Fonts v38](https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcaRyjDg.ttf) | `ff7cf63717c27756df857ca12045a83522569f7b561bedaff813a25274eb263f` |
| `fraunces-700.ttf`             | [Google Fonts v38](https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcUByjDg.ttf) | `f0a9d39b9f14079c55070189562da36c794f824cbcf514b50a0ad0ef20c69379` |

There is no font download or generation script in the install/build pipeline.
Next.js emits these files into `.next/static/media`; the browser loads them from
the application origin. Any future font update should be deliberate, reviewed,
licensed, and accompanied by new provenance and hashes.
