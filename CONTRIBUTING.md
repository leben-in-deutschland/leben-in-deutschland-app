# Contributing

Thank you for helping people prepare for the German naturalisation test. Issues and pull requests are welcome; the [Code of Conduct](CODE_OF_CONDUCT.md) says how we treat each other here.

## Found a mistake in a question?

Open an [issue](https://github.com/leben-in-deutschland/leben-in-deutschland-app/issues/new/choose) and name the question – its number from the [question catalogue](https://www.lebenindeutschland.org/question-catalogue) (for example `127` or `BW-3`) or its first words – and, for a translation, the language. Say what it says now and what would be right.

- The German wording and the four answers come from the official BAMF catalogue and change only when BAMF changes them. The translations and the explanations are this project's own work.
- Please do not edit the question files in a pull request. `src/web/data/question.json` is written only by the tooling in [`src/catalogue`](src/catalogue/README.md), and `questions-core.json` and `src/web/public/data/` are generated from it.

## Other ways to help

- **A bug** – open an issue: what you did, what you expected, what happened, and where (website, Android app, iPhone/iPad app).
- **An idea** – start with an issue or a [discussion](https://github.com/leben-in-deutschland/leben-in-deutschland-app/discussions) before writing code, so that nobody builds something that will not be merged.
- **A security problem** – not in a public issue; see [`SECURITY.md`](SECURITY.md).

## Set up

You need Node.js 22. The app lives in `src/web`:

```bash
cd src/web
npm ci             # installs exactly what package-lock.json says
npm run dev        # http://localhost:3000
```

`npm install` can rewrite `package-lock.json` in a different format, depending on your npm version. Commit the lockfile only when you change a dependency.

The native projects (`src/android`, `src/ios`) are needed only for changes to native code; the [README](README.md#development) says how to build them.

## Send a change

1. Fork the repository and create a branch from `main`.
2. Keep the change small and about one thing. When you change behaviour, add or adjust a test – the tests are in `src/web/__tests__` (Vitest).
3. Run the checks in `src/web`:

   ```bash
   npm test
   npm run lint
   npm run typecheck
   npm run build
   ```

4. Open a pull request. Say what changes for the learner and how you checked it.

The app's own texts are in `src/web/data/translations` in German and English; a test keeps the two languages in step, so a new text needs both.

## Rules every change follows

[`AGENTS.md`](AGENTS.md) is the operating guide of this repository, for agents and for people. The short version:

- **No secrets and no personal data.** The repository, its history and its Actions logs are public. No keys, passwords, keystores, private e-mail addresses, device serials or home paths – use placeholders such as `<project>`.
- **No account, no ads, no tracking.** Learning data stays on the device, and the [privacy policy](https://www.lebenindeutschland.org/privacy-policy) says so. A change has to keep that true.
- **Data files are written by their scripts.** The question catalogue, the evaluation status and the list of exam centres come from bamf.de through `src/catalogue` and `scripts/bamf-data-sync.mjs`. Do not edit them by hand.
- **Store wording is neutral.** The iOS app must not name Google Play: store names and rating links go through `storeName()` and `storeRatingUrl()` in `src/web/utils/app-store.ts`.
- **The native apps stay in step.** A plugin that exists for Android and for iOS (`TipJar`, `AppSystemBars`) keeps the same method names and JSON shapes on both sides.
- **Release signing and store publishing belong to the owner.** A pull request that touches them needs its reason in the description.

## Commit messages

Start with the area or the kind of change – `web:`, `ios:`, `android:`, `catalogue:`, `store:`, `docs:`, `ci:`, `fix:` – and say in one sentence what changes, for example `web: the mock exam keeps its timer when the app goes to the background`. Put the why in the body when it is not obvious.

## How this project is run

The project is managed by [Hive](https://hivefleet.dev/): AI agents do the standing work – data updates from bamf.de, translations, tests, fixes – and send their changes as pull requests too. One human owner makes the decisions: what gets built, the answer to every new official question, each app release, and what is merged.

## Licence

The code is under the [MIT licence](LICENSE), and your contribution is published under the same licence. The question catalogue is published by the Federal Office for Migration and Refugees (BAMF).
