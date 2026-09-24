import * as fs from 'fs';
import * as readline from 'readline'
import { JSONFilePreset } from 'lowdb/node';

const db = await JSONFilePreset('db.json', { words: [] as Word[] });

if (db.data.words.length == 0) {
  let file_data = await processLineByLine();
  for (const word of file_data) {
    db.data.words.push(word);
  }

  await db.write()
  console.log(`Wrote ${db.data.words.length} words to the database`);
} else {
  console.log(`DB already populated with ${db.data.words.length} words.`);
}

let lines = await processLineByLine();
console.log(lines.slice(0, 20));

async function processLineByLine(): Promise<Word[]> {
  const fileStream = fs.createReadStream('src/all_words.md');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const processedLines: Word[] = [];

  let idx = 1;
  for await (const line of rl) {
    let mappedLine = line.split('/').map(c => c.trim());
    let json_word: Word = {
      "id": idx,
      "hanzi": mappedLine[0]!,
      "pinyin": mappedLine[1]!,
      "meaning": mappedLine[2]!
    }
    idx += 1;

    processedLines.push(json_word);
  }

  return processedLines;
}

type Word = {
  id: number;
  hanzi: string;
  pinyin: string;
  meaning: string;
}
