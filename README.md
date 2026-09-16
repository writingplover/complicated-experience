# Complicated

An interactive web experience around Avril Lavigne's "Complicated", built by a team in 90 minutes.
Read [PROJECT.md](PROJECT.md) for the concept and current status, then [CLAUDE.md](CLAUDE.md) for the rules of working in parallel.

## Quickstart

```bash
pnpm install --ignore-scripts
pnpm dev
```

## Add your scene

1. Copy `src/scenes/_template/` to `src/scenes/<your-id>/`.
2. Set `id` to the folder name, claim an `order` number in the channel, add your name.
3. Rename the `template-` CSS prefix to `<your-id>-`.
4. Build it. Run `pnpm typecheck`. Commit to `main` with `git pull --rebase && git push`.

## Scene order

| order | id    | owner |
| ----- | ----- | ----- |
| 10    | intro | shell |
| 20    | song  | shell |
| 30–90 | yours | claim in the channel |
| 100   | outro | free  |
