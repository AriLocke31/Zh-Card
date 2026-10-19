# Codebase overview

This reference describes implemented source. Production rollout is tracked separately in the [roadmap](../roadmap/index.md).

## Entry and module graph

```text
index.html -> src/main.tsx -> App.tsx
  main.tsx -> theme.ts (ThemeProvider + CssBaseline)
  App.tsx -> config.ts -> auth/session.ts
                       -> repositories/ApiWordRepository.ts
                          -> repositories/WordRepository.ts
                          -> validation/word.ts -> types.ts + utils/pinyin.ts
  App.tsx -> components/WordDetail.tsx
          -> components/WordEditor.tsx
             -> components/PinyinInput.tsx -> utils/pinyin.ts
             -> components/SenseTagInput.tsx
             -> utils/hanziConversion.ts
  utils/pinyin.ts -> data/pinyinSyllables.ts

API Gateway -> src/backend/src/handler.ts -> validation/word.ts
                                         -> DynamoDB
```

All four custom UI components remain active. App uses the authenticated HTTP repository, not mock data or browser LowDB. mockWords.ts is now a test fixture. The backend is an independently bundled entry point but shares validation/types/Pinyin source with the frontend. AuthSession supplies access tokens to the repository; App gates loading behind login.

## References

- [All types](types.md) and [components](components.md)
- [Word Editor](word-editor.md)
- [Utilities and data](utilities.md)
- [Backend, repository, and legacy storage](storage.md)
- [HTTP/auth/concurrency/deployment details](../architecture/persistence.md)
- [Prototype and unused-file audit](unused-files.md)

The root TypeScript configuration also discovers backend/prototype/tests source; typecheck inclusion is not evidence of browser reachability. npm build uses tsc --noEmit before bundling with Vite.
