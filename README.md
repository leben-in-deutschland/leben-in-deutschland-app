<p align="center">
  <a href="https://www.lebenindeutschland.org">
    <img src="src/web/public/android-chrome-512x512.png" width="160" alt="" />
  </a>
</p>
<h1 align="center">Einbürgerungstest – Leben in Deutschland</h1>
<p align="center">
  Prepare for the German naturalisation test with every official question, a mock exam that feels like the real one, and a clear view of how ready you are.<br/>
  Web app, Android app and iPhone/iPad app from one code base – offline, private, free.
</p>
<p align="center">
  <a href="https://play.google.com/store/apps/details?id=org.lebenindeutschland.app">Google Play</a> ·
  <a href="https://apps.apple.com/de/app/id6829151281">App Store</a> ·
  <a href="https://www.lebenindeutschland.org">lebenindeutschland.org</a>
</p>
<p align="center">
  <sub>Managed by <a href="https://hivefleet.dev/">Hive</a> – AI agents keep the app and its data up to date; one human owner makes the decisions.</sub>
</p>

> This is a private study project, not an official app of the Federal Office for Migration and Refugees (BAMF). The test itself is taken at the BAMF only. Questions © BAMF.

## What the app does

- **All official questions** – the 300 general questions of the "Leben in Deutschland" / Einbürgerungstest catalogue plus the 10 questions of your federal state (all 16 states), with an explanation for every answer.
- **Translations and read-aloud** – questions in English, Turkish, Russian, French, Arabic, Ukrainian and Hindi; system voices read them out.
- **Mock exam like the real one** – 33 questions, 60 minutes, pass at 17 correct; results are kept so you can see your progress.
- **Exam readiness** – a readiness score from what you know and how your mock exams went, progress per topic, a countdown to your exam date.
- **Practice modes** – new questions, due reviews (spaced repetition), mistakes, flagged questions; quick rounds of 10 or longer sessions.
- **Stay on track** – streak with rest days and streak freezes, daily goal, weekly overview, optional reminders (apps), milestones.
- **Exam centres** – find a test centre near you.
- **Offline, private, free** – no account, no ads, no tracking; everything stays on the device. The apps offer optional tips that unlock nothing.

## Screenshots

<p>
  <img src="src/web/public/mobile/app-1.png" alt="Home: exam readiness, streak and daily goal" width="180"/>
  <img src="src/web/public/mobile/app-2.png" alt="Practice with instant feedback and explanation" width="180"/>
  <img src="src/web/public/mobile/app-3.png" alt="Question translated into one of seven languages" width="180"/>
  <img src="src/web/public/mobile/app-4.png" alt="Mock exam: 33 questions, 60 minutes" width="180"/>
</p>
<p>
  <img src="src/web/public/mobile/app-5.png" alt="Progress per topic" width="180"/>
  <img src="src/web/public/mobile/app-6.png" alt="Streak and calendar" width="180"/>
  <img src="src/web/public/mobile/app-7.png" alt="Practice modes" width="180"/>
  <img src="src/web/public/mobile/app-8.png" alt="Settings" width="180"/>
</p>

## Repository layout

| Path | What it is |
| --- | --- |
| [`src/web`](src/web) | The app: Next.js (static export), React, HeroUI, Tailwind; tests with Vitest. Serves the website and is bundled into both native apps. |
| [`src/android`](src/android) | Capacitor Android project (Play Billing tips, notifications, status bar). |
| [`src/ios`](src/ios) | Capacitor iOS project (StoreKit 2 tips, notifications). |
| [`src/store`](src/store) | Store assets and publishing: screenshot pipeline, Google Play and App Store Connect scripts ([README](src/store/README.md)). |
| [`src/catalogue`](src/catalogue) | Tooling that keeps the question catalogue in sync with the official BAMF publication ([README](src/catalogue/README.md)). |
| [`src/termine`](src/termine) | Exam dates: reads the exam centres' own course pages every six hours and publishes them for `/termine` ([README](src/termine/README.md)). |
| [`.github/workflows`](.github/workflows) | Web deploy on merge; Android and iOS releases started by hand. |
| [`.hive/automations`](.hive/automations) | Standing data syncs (BAMF catalogue, evaluation status, exam centres, exam dates) that the [Hive](#managed-by-hive) daemon runs; [`scripts`](scripts), [`src/catalogue`](src/catalogue) and [`src/termine`](src/termine) hold what they call. |
| [`.hive/skills`](.hive/skills) | Agent skills; [`AGENTS.md`](AGENTS.md) holds the repository rules. |

## Development

Prerequisites: Node.js 22. For the native apps additionally Android Studio with JDK 21, or Xcode 26 with CocoaPods.

```bash
cd src/web
npm ci             # installs exactly what package-lock.json says
npm run dev        # http://localhost:3000
npm test           # Vitest, the project's verification command
npm run lint
npm run typecheck  # tsc --noEmit; vitest does not type-check, the build does
npm run build      # static export into src/web/out
```

Optional: with [pre-commit](https://pre-commit.com) installed, `pre-commit install` scans every commit for secrets before it is made.

Native apps (the web build is copied into the native projects by Capacitor):

```bash
cd src
make build-sync        # install, build, sync Android -> open src/android in Android Studio
make build-sync-ios    # install, build, sync iOS     -> open src/ios/App/App.xcworkspace in Xcode
```

The learner's data is a single record in `localStorage`; a dev build therefore starts with onboarding like a fresh install.

## Data

- **Questions** come from the official BAMF catalogue. A daily check looks for a new publication; when one appears, an agent compares it with the bundled catalogue, applies the safe part and hands the rest to a human review; the apps also refresh the catalogue over the air, at most once a day, from this repository.
- **Evaluation status and exam centres** are read from bamf.de by `scripts/bamf-data-sync.mjs`: a daily check (evaluation status and "last checked" date) and a weekly check (the exam centres of the 16 states) rewrite the bundled JSON files when the site changed; the Android app also refreshes the evaluation status over the air from this repository.
- **Exam dates** come from the exam centres' own course pages. Every six hours a script reads them and publishes one file, which the website and the apps load; nothing of it is bundled, and no agent is involved.

## Managed by Hive

This project is managed by [Hive](https://hivefleet.dev/): a team of AI agents works on it under one human owner. The owner makes the decisions that matter – what gets built, the answer to every new official question, each app release – and the agents do the standing work in between.

- **Standing work** – Hive runs the checks in [`.hive/automations`](.hive/automations) every day (the exam centres every week). When BAMF has published something new, an agent follows the matching skill in [`.hive/skills`](.hive/skills), updates the bundled data, runs the tests and hands the change in. The exam dates need no agent: Hive runs their script every six hours, and the script publishes what it read.
- **Improvements** – agents propose changes on a shared board, vote on each other's proposals and test what they build against the project's own checks: translations, explanations, accessibility, tests.
- **Rules and memory** – [`AGENTS.md`](AGENTS.md) holds the rules every agent and every contributor follows. Decisions, plans and lessons learned are records in the Hive store, not files in this repository.

## Releases

- **Web** – every merge to `main` deploys to Vercel.
- **Android** – Actions → *Android Release* → *Run workflow*: signed bundle, GitHub release, upload to the Play Internal testing track; promotion to production is a click in the Play Console.
- **iOS** – Actions → *iOS Release* → *Run workflow*: TestFlight build; the version is submitted from App Store Connect.
- Store listings, products and screenshots are generated and published from [`src/store`](src/store/README.md).

## Privacy

No account, no analytics, no advertising SDKs. Learning data stays on the device; the apps download only public static files (catalogue, evaluation status, notices). Tips are handled by Google Play or Apple In-App Purchase. Full text: [privacy policy](https://www.lebenindeutschland.org/privacy-policy).

## Contributing

Issues and pull requests are welcome. [`CONTRIBUTING.md`](CONTRIBUTING.md) says how to report a mistake in a question, set the project up and send a change; [`AGENTS.md`](AGENTS.md) holds the rules every change follows (tests green, no secrets, store wording, release signing). Security problems go to the owner privately ([`SECURITY.md`](SECURITY.md)), and everyone who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) for the code. The question catalogue is published by the Federal Office for Migration and Refugees (BAMF).
