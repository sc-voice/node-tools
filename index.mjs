import { Files } from './src/memo-again/files.mjs';
import { FilePruner } from './src/memo-again/file-pruner.mjs';
import { GuidStore } from './src/memo-again/guid-store.mjs';
import { MemoCache } from './src/memo-again/memo-cache.mjs';
import { Memoizer } from './src/memo-again/memoizer.mjs';
export const MemoAgain = {
  Files,
  FilePruner,
  GuidStore,
  MemoCache,
  Memoizer,
}

import { DeepLAdapter } from './src/translate/deepl-adapter.mjs'
import { QuoteParser } from './src/translate/quote-parser.mjs'
export const Translate = {
  DeepLAdapter,
  QuoteParser,
}
