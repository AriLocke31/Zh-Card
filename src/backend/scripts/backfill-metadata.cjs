const { createHash } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const formKey = text => `FORM#${createHash('sha256').update(text.trim().normalize('NFC')).digest('hex')}`;

async function initializeMetadata(send, { tableName, metadataTableName, ownerSub, apply = false, writesPaused = false, upgradeFormIndex = false }) {
  if (!tableName || !metadataTableName || !ownerSub || tableName === metadataTableName) throw new Error('Set TABLE_NAME, METADATA_TABLE_NAME (a separate table), and OWNER_SUB.');
  if (apply && !writesPaused) throw new Error('Pause ALL word writers first, then pass --apply --writes-paused.');
  const Key = { userId: ownerSub, key: 'SUMMARY' };
  const { Item: existing } = await send(new GetCommand({ TableName: metadataTableName, Key, ConsistentRead: true }));
  if (existing && (!upgradeFormIndex || existing.formIndexVersion === 1)) throw new Error('Summary already exists; refusing to overwrite counters. Use --upgrade-form-index only for a summary without a form index.');
  let count = 0;
  let cursor;
  const mappings = new Map();
  const collisions = [];
  do {
    const page = await send(new ScanCommand({ TableName: tableName, ProjectionExpression: 'id, forms', ConsistentRead: true,
      ...(cursor ? { ExclusiveStartKey: cursor } : {}) }));
    for (const word of page.Items ?? []) {
      if (typeof word.id !== 'string' || !word.id || !Array.isArray(word.forms) || !word.forms.length) throw new Error('A legacy word has no ID or written forms; repair it before initialization.');
      count++;
      for (const form of word.forms) {
        if (typeof form.text !== 'string' || !form.text.trim()) throw new Error(`Word ${word.id} has an empty written form.`);
        const text = form.text.trim().normalize('NFC');
        const key = formKey(text);
        const previous = mappings.get(key);
        if (previous && previous.wordId !== word.id) collisions.push({ text, wordIds: [previous.wordId, word.id] });
        else mappings.set(key, { userId: ownerSub, key, text, wordId: word.id });
      }
    }
    if (!Number.isSafeInteger(count)) throw new Error('Word count exceeds safe integer range.');
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  if (collisions.length) throw new Error(`Written-form collisions must be resolved before any backfill writes: ${JSON.stringify(collisions)}`);
  if (existing && (existing.wordCount !== count || !Number.isSafeInteger(existing.wordsCreatedTotal) || existing.wordsCreatedTotal < count)) throw new Error('Existing counters disagree with the word table. Reconcile counters before upgrading the index.');
  const now = new Date().toISOString();
  const summary = existing ? { ...existing, formIndexVersion: 1, updatedAt: now }
    : { ...Key, schemaVersion: 1, formIndexVersion: 1, wordCount: count, wordsCreatedTotal: count, initializedAt: now, updatedAt: now };
  if (apply) {
    // Restartable: a partially completed run may safely reassert the same owner/word mappings.
    for (const mapping of mappings.values()) await send(new PutCommand({ TableName: metadataTableName, Item: mapping,
      ConditionExpression: 'attribute_not_exists(userId) OR wordId = :wordId', ExpressionAttributeValues: { ':wordId': mapping.wordId } }));
    // Publish readiness last; mutations refuse to run against a partial form index.
    await send(new PutCommand({ TableName: metadataTableName, Item: summary,
      ConditionExpression: existing ? 'attribute_exists(userId) AND attribute_not_exists(formIndexVersion)' : 'attribute_not_exists(userId)' }));
  }
  return { applied: apply, formMappings: mappings.size, summary };
}
module.exports = { initializeMetadata, formKey };
if (require.main === module) {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  initializeMetadata(command => client.send(command), {
    tableName: process.env.TABLE_NAME, metadataTableName: process.env.METADATA_TABLE_NAME, ownerSub: process.env.OWNER_SUB,
    apply: process.argv.includes('--apply'), writesPaused: process.argv.includes('--writes-paused'), upgradeFormIndex: process.argv.includes('--upgrade-form-index'),
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
