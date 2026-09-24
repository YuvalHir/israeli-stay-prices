# Contributing / תרומה לפרויקט

תודה שאתה רוצה לעזור! Thanks for helping.

1. Open an issue first for anything bigger than a small fix, so we can agree on the direction.
2. Fork, create a branch, make your change.
3. Run `npm install` and `npx next build` (must pass with no TypeScript errors).
4. Test on a phone-sized screen (390px) in RTL.
5. Schema changes: add a new numbered file in `migrations/`, never change an old one.
6. Write commit messages with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), e.g. `feat(ui): add currency switcher` or `fix(api): reject empty prices`. Details and allowed types in [AGENTS.md](./AGENTS.md#commit-messages).
7. Open a pull request with a Conventional Commits title, a short description and a screenshot for UI changes.

Guidelines are in [AGENTS.md](./AGENTS.md) (they apply to humans too). Be kind in reviews and issues.

Ideas we'd love help with: better place search, offline support, price trends, translations, accessibility.
