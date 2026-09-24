import type { WordEntry } from "../types";

export const mockWord: WordEntry = {
  id: "word-001",

  forms: [
    {
      id: "form-001",
      text: "電腦",
      script: "traditional",
      isPreferred: true,
    },
    {
      id: "form-002",
      text: "电脑",
      script: "simplified",
      isPreferred: false,
    },
  ],

  readings: [
    {
      id: "reading-001",
      variety: "cmn",
      system: "pinyin",
      romanization: "dian4 nao3",
      display: "diànnǎo",
      senseIds: ["sense-001"],
      isStandard: true,
      tags: [],
    },
  ],

  senses: [
    {
      id: "sense-001",
      definition: "Computer",
      language: "en",
      partOfSpeech: "noun",

      tags: [
        {
          category: "domain",
          value: "Computing",
        },
      ],

      readingIds: ["reading-001"],

      notes:
        "An electronic device used for processing data.",

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],

  components: [
    {
      id: "component-001",
      text: "電",
      type: "morpheme",
      position: 0,
      entryId: "word-electricity",
      notes: "Electricity",
    },
    {
      id: "component-002",
      text: "腦",
      type: "morpheme",
      position: 1,
      entryId: "word-brain",
      notes: "Brain",
    },
  ],

  tags: ["Mandarin", "Technology"],

  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
