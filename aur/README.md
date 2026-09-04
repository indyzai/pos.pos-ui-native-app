# OpenPOS AUR packages

OpenPOS recognizes these AUR package identities:

| Package                                                                   | Channel | Source                        | Expected owner(s)                                       |
| ------------------------------------------------------------------------- | ------- | ----------------------------- | ------------------------------------------------------- |
| [`openpos-bin`](https://aur.archlinux.org/packages/openpos-bin)           | Stable  | GitHub release `.deb`         | Maintainer `dongdongbh`                                 |
| [`openpos-beta-bin`](https://aur.archlinux.org/packages/openpos-beta-bin) | RC/beta | GitHub prerelease `.deb`      | Maintainer `dongdongbh`                                 |
| [`openpos-bin-beta`](https://aur.archlinux.org/packages/openpos-bin-beta) | RC/beta | Legacy compatibility identity | Maintainer `dongdongbh`                                 |

The source-built `openpos` package on the AUR is community maintained; the OpenPOS project does not publish, audit, or support it.

Treat a different upstream URL or an unexpected ownership change as a security event. The machine-readable policy is in [`trusted-packages.json`](trusted-packages.json).

## Install

Review every AUR file before building. For example:

```bash
git clone https://aur.archlinux.org/openpos-bin.git
cd openpos-bin
git log --oneline -10
less PKGBUILD .SRCINFO
makepkg --verifysource
makepkg -sri
```

The source URLs must resolve to `https://github.com/dongdongbh/OpenPOS`, executable and source artifacts must have full SHA-256 checksums, and `.SRCINFO` must match `PKGBUILD`. OpenPOS AUR packages must not contain install scripts, remote-shell commands, persistence hooks, or `SKIP` checksums for executable/source content.

### Beta package rename

`openpos-beta-bin` is the current beta package name. `openpos-bin-beta` remains updated from the same signed release artifacts during the transition, so existing installations continue receiving RC and stable updates. AUR helpers do not reliably migrate package identities from `replaces` metadata alone.

To move explicitly, review the new package and then replace the legacy identity:

```bash
sudo pacman -R openpos-bin-beta
paru -S openpos-beta-bin
```

Removing the package does not remove OpenPOS's user data. The legacy identity will remain published through at least two stable releases after v1.2.5 and for at least 60 days. After both gates pass, announce the retirement before stopping legacy updates or requesting an AUR merge.

## Release trust anchor

OpenPOS publishes `SHA256SUMS` with release artifacts and signs new manifests as `SHA256SUMS.asc`. The primary signing-key fingerprint is:

```text
0358 999B BE70 4F58 8B90  9497 9E55 3245 CB17 047D
```

Verify the fingerprint independently before trusting the key. A typical verification is:

```bash
gpg --verify SHA256SUMS.asc SHA256SUMS
sha256sum --check SHA256SUMS
```

## Publishing policy

All recognized packages publish directly from release jobs:

1. Generate the package's `PKGBUILD` and `.SRCINFO` from the release tag.
2. Reject unexpected files, owners, sources, commands, or skipped checksums (`scripts/ci/validate-aur-package.mjs`).
3. Build in a clean Arch container.
4. Re-verify the package's maintainer, co-maintainers, and upstream URL against the trusted policy immediately before pushing (`scripts/ci/audit-aur-state.mjs`); ownership drift aborts the push.
5. Push a single, non-force commit over a dedicated SSH credential.

A recognized AUR maintenance response (pushes disabled) marks the channel delayed rather than failing the job; an unexpected rejection fails it.

## Maintainer security

- Keep `dongdongbh` as maintainer or co-maintainer of all recognized packages.
- Use a dedicated, passphrase-protected Ed25519 AUR key that is not shared with GitHub, servers, or general build machines.
- Store the publishing key only as the `AUR_SSH_PRIVATE_KEY` secret in the protected `aur-publish` Environment.
- Never orphan a package for temporary maintenance convenience and never force-push AUR history.

The AUR is unofficial. Automation catches policy drift, but it does not replace reviewing the actual package diff and build behavior.
