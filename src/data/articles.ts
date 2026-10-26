import readingNotes from "./articles/reading-notes.json";
import paperAndPrint from "./articles/paper-and-print.json";
import dailyPractice from "./articles/daily-practice.json";
import languageJournal from "./articles/language-journal.json";
import type { ArticleData } from "../types";

// Explicit ordering keeps pagination predictable. Add new JSON imports here.
export const articles: ArticleData[] = [readingNotes, paperAndPrint, dailyPractice, languageJournal];
