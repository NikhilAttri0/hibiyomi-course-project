# Hibiyomi — Course Project

A web app for learning Japanese kanji for the JLPT (N5 and N4), with a simple classroom for teachers.

> **Course project snapshot.** This repository is an early version of the project, shared for academic review only.
> It does not contain the current product, and parts of it have been removed.

## Features in this version

- Kanji library for JLPT N5 and N4, with meanings, readings and example words
- Flashcard reviews with a spaced-repetition schedule (SM-2 style)
- Quizzes on meaning, reading and recognition
- Stroke-order animation and a writing pad
- Vocabulary lists per lesson
- Progress charts
- Accounts for students, teachers and admins
- Teacher classroom: batches with join codes, materials and assignments

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS
- SQLite / libSQL database
- Jest for tests

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The first account created becomes the admin.

```bash
npm test          # unit tests
npm run build     # production build
```

## Credits

Stroke-order data: [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, CC BY-SA 3.0.

## Copyright

© 2026 Nikhil Attri. All rights reserved. See [LICENSE](LICENSE).
