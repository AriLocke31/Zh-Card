# Components

All components are default exports. Paths are relative to the repository root. [Word Editor](word-editor.md) documents the largest component separately.

## App (`src/App.tsx`)

Props: none. Owns login readiness, authentication errors, and the saving flag that disables navigation during mutations. BrowserRouter is mounted in main.tsx. App completes the Cognito callback before rendering routes, preserving callback query processing before the root redirects to /words.

The header shows a centered ?? h1 in a bold Chinese serif stack. Beneath it, four equal-width text options?Words, Create, Articles, Account?sit above a single thin horizontal rule. The active route uses dark red text (#8b1e1e). Header controls use transparent backgrounds. Articles (/articles) is a placeholder; Account opens UserPopup. The mahjong tile remains the favicon. A signed-in root or unknown route redirects to /words. Login gates the routed content; sign-out unmounts page data. There is no fixture fallback.

## WordsPage (src/pages/WordsPage.tsx)

WordsPageProps requires repository: WordRepository. Loads one GET /words page at a time (25 records per repository request) and renders a responsive two/three/five-column grid of WordThumb components. Shows loading, empty, and error/retry states; there is no content heading or Refresh button. Pending pages do not show the previous page's cards. Effect cleanup ignores outdated/unmounted responses.

The current opaque cursor is encoded in the URL query. Previously visited cursors are stored in browser navigation state for Previous; Next uses WordPage.nextCursor and replaces the visible grid rather than appending records. Previous is disabled on the first page and Next when nextCursor is absent. Direct cursor links without previous history can return to the first page. Cursor pagination does not infer a total count or stable ordering from DynamoDB Scan.

## WordThumb (src/components/WordThumb.tsx)

WordThumbProps: word: WordEntry, returnTo?: string (default /words), returnState?: unknown. A transparent, borderless Box renders as a real React Router link to /words/:id, encoding the ID. It shows only the preferred WrittenForm.text, falling back to the first form and then '-'. Native link behavior supports keyboard navigation and opening a detail page in another tab.

returnTo/returnState retain the list URL and pagination history so Back to words can restore the originating grid page. They add no visible metadata to the thumbnail.

## WordPage (src/pages/WordPage.tsx)

WordPageProps requires repository: WordRepository and onSavingChange: (saving: boolean) => void; creating?: boolean defaults to false. /words/:id fetches the word independently and renders WordDetail with edit/delete actions. /words/new starts WordEditor with a blank draft. Creation navigates to the server-generated ID; updates retain their detail route. API failures leave editor drafts mounted. Delete confirms and returns to the originating list page. The list refetches on return, reflecting mutations.

## WordDetail (`src/components/WordDetail.tsx`)

Private `WordDetailsProps`:

| Prop | Type | Behavior |
| --- | --- | --- |
| `word` | `WordEntry` | Required entry to display. |
| `onCreateFlashcard?` | `(word: WordEntry) => void` | When supplied, shows a Create Flashcard button and passes the complete word on click. App does not supply it. |

Chooses the first preferred form, falling back to the first form or `-`. Chooses the first standard Mandarin reading, falling back to the first reading; displays `display ?? romanization` or `No pronunciation`. An empty display string does not trigger that nullish fallback. Renders alternative forms, word tags, definitions, part of speech, sense tags and notes, and structural components. It displays arrays in their supplied order and does not resolve component entry links or filter senses by reading. Bookmark is disabled.

## PinyinInput (`src/components/PinyinInput.tsx`)

Private `PinyinInputProps`:

| Prop | Type | Behavior |
| --- | --- | --- |
| `romanization` | `string` | Initial input, converted through parsePinyin when possible. |
| `display?` | `string \| undefined` | Accepted but currently unused by the implementation. |
| `onChange` | `(romanization: string, display: string) => void` | Called after text changes with parsed values, or raw text and an empty display if parsing fails. |
| `sx?` | `SxProps<Theme>` | Forwarded to the outer Material UI Autocomplete. |

Maintains local input, dropdown visibility, and blur state. It initializes from props once and does not synchronize subsequent romanization prop changes; remount to reset it. `getActiveSyllable` returns the last whitespace-delimited token, or an empty string after trailing whitespace. Valid base syllables offer five tone choices. Selecting one replaces the active token and appends a space. Number keys 1-5 select tones unless composing with an IME or using Ctrl/Alt/Meta. Escape/blur close suggestions. Nonempty invalid input shows an error after blur; parent validation still controls saving.

Pinyin canonical values use numbered syllables; tone-marked display and explicit neutral-tone editing are described in [utilities](utilities.md).

## SenseTagInput (`src/components/SenseTagInput.tsx`)

Private `SenseTagInputProps` has one required prop: `onAdd: (tag: SenseTag) => void`.

Owns a category (initially register) and text value. Offers all six SenseTag categories. Add or Enter trims the value, ignores blanks, calls onAdd, and clears the text while retaining the category. The button is disabled for whitespace-only input. Duplicate detection belongs to WordEditor; this component does not perform it.

## UserPopup (src/components/UserPopup.tsx)

UserPopupProps requires loggedIn: boolean, onSignIn: () => void, and onSignOut: () => void; disabled?: boolean defaults to false. An optional label: string replaces the default AccountCircle IconButton with a text button. The trigger opens a Material UI Menu with an Account placeholder link and either Sign in or Sign out according to loggedIn. Selecting an action closes the menu before invoking the callback. The Account link has an empty destination and prevents navigation until an account page is implemented. The trigger exposes its menu/expanded state to assistive technology.

The existing theme in src/theme.ts now gives MuiButton and MuiIconButton white backgrounds and black text, with a light-gray hover state and muted disabled text. Active navigation is indicated by an inset underline.

WordThumb uses a bold Chinese serif font stack (Noto Serif CJK SC, Noto Serif SC, Source Han Serif SC, Songti SC, SimSun, serif), centered text, and red underlining on hover and keyboard focus. It has no card background, border, or shadow. Fonts are used when installed; no remote font is loaded. Noto Serif CJK SC can be downloaded from https://github.com/notofonts/noto-cjk/tree/main/Serif.

On Create, WordPage hides Back to words and shows a right-aligned Create selector above the editor. CreationType is Word | Article | Sentence, defaulting to Word. Article and Sentence currently display explicit unavailable-editor placeholders. WordEditor stays mounted but hidden for these selections, preserving the Word draft; selection is disabled during saving. Existing detail pages retain Back to words.
