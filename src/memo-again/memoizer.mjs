import { Text } from '@sc-voice/tools';
const { MerkleJson } = Text;
import { MemoCache } from './memo-cache.mjs';

export class Memoizer {
  constructor(opts = {}) {
    let { logger = console, context = 'global' } = opts;
    this.mj = new MerkleJson();
    this.context = context;
    this.logger = logger;
    this.cache =
      opts.cache ||
      new MemoCache({
        logger,
        storeName: opts.storeName,
        storePath: opts.storePath,
        writeMem: opts.writeMem,
        writeFile: opts.writeFile,
        readFile: opts.readFile,
        serialize: opts.serialize,
        deserialize: opts.deserialize,
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
    let { mj, cache } = this;
    let volume = this.volumeOf(method, context);
    let fbody = method.toString();
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
