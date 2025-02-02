const { MerkleJson } = require('merkle-json');
const MemoCache = require('./memo-cache');

export class Memoizer {
  constructor(opts = {}) {
    this.mj = new MerkleJson();
    this.context = opts.context || 'global';
    this.cache =
      opts.cache ||
      new MemoCache({
        logger: this,
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
    try {
      let volume = this.volumeOf(method, context);
      await this.cache.clearVolume(volume);
    } catch (e) {
      console.error(
        msg,
        JSON.stringify({ method, context }),
        e.message,
      );
      throw e;
    }
  }
}
