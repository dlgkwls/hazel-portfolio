# AGENTS.md: hazel-portfolio

Rules for any AI tool (Claude Code, Codex) working on this website. Hazel is not a coder: explain anything non-obvious in one plain sentence.

## Before editing content

- The full spec is **`../PRD-Hazel-Portfolio-Website.md`**, one folder up and deliberately **not** in this public repo. Read it before writing or changing any page copy.
- Its §6 has the **banned-claims table**. Check every sentence you add or change against it.
- The single source of truth for experience wording is Hazel's private Experience DB (path in PRD §6). If a sentence needs changing, it changes there first, then here.
- Deviations from the PRD are logged in `../DEVIATIONS.md`. If you deviate for any reason, add a note there explaining why. Never silently improvise.

## Constraints

The site is becoming two motion pages (plan: `../PROMPT-Final-Portfolio.md`): `portfolio.html`, the Matcha Lemonade hub (built in F1), and `index.html`, the Fab-to-Atom front door (F2). The old plain pages stay until F3 moves every link to the new pages and deletes them.

- Static files only: no frameworks, no server. It must work when a page is opened by double-clicking, and on GitHub Pages. Use relative links.
- JavaScript draws the pictures only: Canvas 2D on `portfolio.html`, WebGL on `index.html`. Every word is real HTML text, never drawn on the canvas, and the page reads in full with JavaScript off.
- `assets/js/glass.js` is built from `../Matcha Lemonade/source/illustration/` by its `build.sh`. Edit the source parts there and rebuild; never edit `glass.js` by hand. The page's words live in `portfolio.html` itself.
- "Read more" and "More detail" use the built-in `<details>` / `<summary>` element, so they work without JavaScript and with a keyboard and screen reader.
- The hub is always cream and the front door always dark (no light/dark switching). Text meets WCAG AA; put a solid paper panel behind any text that sits over the drawing.
- One Google font per page: Instrument Serif (hub), Barlow (front door), with system fallbacks.
- Comfortable at 375 px wide with no sideways scrolling, up to large desktops.
- Fast: each page under about 1 MB; each image 300 KB or less (WebP or JPEG).
- Accessible: semantic headings, alt text on every image, visible keyboard focus, `prefers-reduced-motion` respected (the drink appears step by step without pouring).
- Every page has a title ("Hazel Lee", "Hazel Lee · Portfolio"), a meta description and an Open Graph image (added in F2).
- Hub design tokens live at the top of `assets/css/portfolio.css`; the old pages use `assets/css/site.css`. Change colors there, nowhere else.

## Content rules

1. **Simple first, technical on click.** Each card shows dates, organization, title, city, the summary and "What I learned"; "Read more" opens the plain bullets, and "More detail" inside it the technical ones.
2. **Copy bullets as written.** You may trim a clause, fix a typo, or merge two bullets about the same task. Never add a new fact, number, tool or result.
3. **Contributor-level verbs.** Never write Led (except FortisBC's weekly Monday meeting), Approved, Engineered, Designed, Optimized, Diagnosed, Automated, Validated or "Identified the root cause".
4. **Banned claims:** see PRD §6 (private). When unsure, leave it out and ask Hazel.
5. **Voice:** first person, plain, warm, short sentences. Avoid *passionate, leverage, spearhead, synergy, dynamic, results-driven, cutting-edge*. No exclamation marks, don't overuse dashes, and nothing should sound AI-written.
6. **Not desperate:** "open to", never "seeking any". The availability line stays small and calm.
7. **Privacy:** no phone number, student number, partner or coworker names, patient information, or internal company documents or data. Strip GPS data from every photo. No one else's face without their OK; otherwise crop them out.
8. **Drafts:** blocks marked [DRAFT] in the PRD carry a `data-draft` attribute (which shows a visible orange DRAFT tag) plus a `<!-- [DRAFT] -->` comment, until Hazel approves or rewrites them. On approval, remove both. Nothing may carry `data-draft` at launch.

## Files

```
portfolio.html             The hub: five sections (Co-op experience, Academic, Projects, Just for fun, About me)
assets/css/portfolio.css   Hub styles; design tokens at the top
assets/js/glass.js         Hub drawing (built; see Constraints)
index.html                 Old plain Home (replaced by the Fab-to-Atom front door in F2)
experience.html            Old timeline (deleted in F3)
projects.html              Old empty shell (deleted in F3)
about.html                 Old empty shell (deleted in F3)
assets/css/site.css        Old pages' styles
assets/img/                Images and the favicon
assets/Hazel_Lee_Resume.pdf   (added in F3)
README.md                  What this repo is
AGENTS.md                  This file
```

Each timeline entry and project card is wrapped in `<!-- ENTRY: id -->` … `<!-- /ENTRY -->` so any tool can find and edit it.

## Never commit private files

Nothing from Hazel's private folders goes in this repo: the Experience DB, the PRDs, conversation archives, lab reports or raw data, internal memos, or company-specific resumes. Charts are committed as finished images only; raw CSVs stay private.

## Uploading

This repo publishes to `https://dlgkwls.github.io/hazel-portfolio/`. **Never push without Hazel's explicit OK.** Pushing to `main` changes the live site.

## Add a project (recipe)

1. Hazel describes the project. If it's an experience, update the Experience DB first.
2. Copy an existing `<!-- ENTRY -->` card block in the right section of `portfolio.html` (Projects or Just for fun).
3. Fill in the title, 2 to 3 sentences, the "What I learned" line, links and tags, following the content rules.
4. Add one image (300 KB or less, with alt text) if there is one.
5. Check at 375 px and 1280 px wide.
6. Update the resume PDF if the project belongs there.
7. Commit with a clear message.

## After each milestone

Give Hazel a "VERIFY THIS" checklist of 5 hand-checks Hazel can do in the browser, with no coding.
