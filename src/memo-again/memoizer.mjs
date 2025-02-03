import path from 'node:path';
import { Text } from '@sc-voice/tools';
const { MerkleJson } = Text;
import { DBG } from '../defines.mjs';
import { Files } from './files.mjs';
import { MemoCache } from './memo-cache.mjs';

const DEFAULT_MEMO_CACHE = undefined;
const DEFAULT_READ_FILE = undefined;
const DEFAULT_STORE_PATH = undefined;

export class Memoizer {
  constructor(opts = {}) {
    let {
      cache = DEFAULT_MEMO_CACHE,
      context = 'global',
      deserialize = MemoCache.deserialize,
      logger = console,
      readFile = DEFAULT_READ_FILE,
      serialize = MemoCache.serialize,
      storeName = 'memo',
      storePath = DEFAULT_STORE_PATH,
      writeFile = true,
      writeMem = true,
    } = opts;
    if (readFile == null) {
      readFile = writeFile;
    }
    if (storePath == null) {
      storePath = path.join(Files.localPath(), storeName);
    }
    if (cache == null) {
      cache = new MemoCache({
        deserialize,
        logger,
        readFile,
        serialize,
        storeName,
        storePath,
        writeFile,
        writeMem,
      });
    }
    let mj = new MerkleJson();
    Object.assign(this, {
      cache,
      context,
      logger,
      mj,
      storeName,
      storePath,
    });
  }

  volumeOf(method, context) {
    let methodName = (method && method.name) || 'lambda';
    let contextName =
      (typeof context === 'string' && context) ||
      (context && context.name) ||
      this.context;
    return `${contextName}.${methodName}`;
  }

  memoize(method, context) {
    const msg = 'm6r.memoize:';
    const dbg = DBG.M6R_MEMOIZE;
    let { mj, cache } = this;
    let volume = this.volumeOf(method, context);
    let fbody = method.toString();
    dbg && console.log(msg, { fbody, volume });
    let fmemo = (...args) => {
      let key = {
        volume,
        fbody,
        args,
      };
      let guid = mj.hash(key);
      let value = this.cache.get({ guid, args, volume });
      if (value === undefined) {
        let actualValue = method.apply(undefined, args);
        value = cache.put({
          guid,
          args,
          volume,
          value: actualValue,
        });
      }
      return value;
    };
    return fmemo;
  }

  async clearMemo(method, context) {
    const msg = 'm6r.clearMemo:';
    let { logger } = this;
    try {
      let volume = this.volumeOf(method, context);
      await this.cache.clearVolume(volume);
    } catch (e) {
      logger.error(
        msg,
        JSON.stringify({ method, context }),
        e.message,
      );
      throw e;
    }
  }
}
