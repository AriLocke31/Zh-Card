# Unused-file and prototype audit

## Scope and method

Traced local imports from index.html -> src/main.tsx, inspected all source imports, and checked package scripts, package main, Jenkinsfile, and other text references. This establishes repository wiring; it cannot establish whether someone runs a standalone script manually or needs historical vocabulary data. No files were deleted in this audit.

## Removal candidates

| File | Evidence | Cleanup considerations |
| --- | --- | --- |
| `src/App.css` | No stylesheet import or HTML link; current components use Material UI styling. | Can be removed from the current app without changing its rendered styles. |
| `src/data.ts` | No importers; App now saves through ApiWordRepository. | Can be removed if browser LowDB persistence and its backup helpers are no longer wanted. It is the only browser LowDB consumer. Preserve/export any useful localStorage data separately. |
| `src/index.ts` | No importers or npm script; standalone legacy LowDB importer. | Can be removed if manual vocabulary import is retired. Audit its input and database together. |
| `main.js` | No frontend import or npm script; only initializes LowDB with a posts default. | package.json still declares it as main. Remove/update that declaration when retiring the file. It is not the Vite entry. |
| `main.py` | No application, package script, or CI references. | Standalone vocabulary shuffle utility. It opens all_words.md relative to the current directory, whereas the checked-in input is under src/. Can be retired if no longer run manually. |

After retiring all three LowDB modules (`src/data.ts`, `src/index.ts`, `main.js`), lowdb has no remaining source consumer. Remove the dependency and update the lockfile together in that cleanup. react-router-dom now powers the browser routes, navigation, and thumbnail links; retain it. tsx is now used by npm test and must be retained.

## Disconnected files requiring a decision

| File or declaration | Reason to retain or review |
| --- | --- |
| `src/all_words.md` | Input to the legacy importer; not browser data. Archive or retain if the vocabulary corpus is valuable. Remove only when its importer/data workflow is retired. |
| `db.json` | Used by both standalone JavaScript/TypeScript LowDB scripts. Contains data, not just executable prototype code; inspect/archive before deletion. |
| `new_words.txt`, `quotes.md` | No code or CI references found. Personal/source content can still be useful; lack of imports is not evidence it is disposable. |
| `src/data/mockWords.ts` | No longer imported by App; retained as the fixture used by persistence tests. |
| `Flashcard`, `ReviewState`, `ExampleSentence` in `src/types.ts` | No current consumers, but represent planned domain features. They are not unused files; retain or remove according to feature scope. |
| `src/backend/lambda.zip` | Generated artifact recreated and consumed by Jenkins. Consider excluding it from version control, while retaining the pipeline's generation and deployment steps. |

## Keep: active or separately used

All files under src/components are reachable from App. pinyinSyllables.ts, both utility modules, shared validation, types.ts, theme.ts, config.ts, repository modules, App.tsx, and main.tsx are active. mockWords.ts is used by the integration tests.

The backend source/configuration and Jenkins/Docker configuration are a separate build/deployment workflow. They remain required by the backend deployment workflow. Documentation and its MkDocs/Python configuration likewise have a separate purpose.

The root tsconfig currently discovers source outside the frontend graph, including the Node importer and backend. Removing disconnected code may change typechecking results even though it leaves browser behavior unchanged. Use `tsc --noEmit` for a read-only typecheck: npm build now also uses tsc --noEmit before Vite, avoiding generated files alongside source.

src/auth/session.ts is active through config.ts, supplying the authenticated repository and App login controls. Keep its PKCE/refresh regression tests.
