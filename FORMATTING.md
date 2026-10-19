# Formatting

Prettier 3.5.3 is pinned at the repository root. Use two spaces, single quotes,
semicolons, trailing commas, a 110-column print width, and LF line endings.
The root `.editorconfig` applies the same indentation in editors.

Run `bun run format` / `bun run format:check` in Bun workspaces, or
`yarn format` / `yarn format:check` in Yarn repositories. Run the check before
committing. Configure your editor to use the workspace Prettier version and
format on save.

Generated files, lockfiles, build output, dependencies, native platform projects,
and vendored repositories are excluded. Format the shared UI repository directly
before updating a consuming app's submodule commit.
