import fs from 'node:fs';
import path from 'node:path';
import { Text } from '@sc-voice/tools';
const { Logger, MerkleJson } = Text;
const { dirname: __dirname, filename: __filename } = import.meta;
import { DBG } from '../defines.mjs';
import { Files } from './files.mjs';
import { GuidStore } from './guid-store.mjs';

export class MemoCache {
  constructor(opts = {}) {
    this.map = {};
    let {
      deserialize = MemoCache.deserialize,
      logger = console,
      readFile,
      serialize = MemoCache.serialize,
      store,
      suffix = '.json',
      writeFile = true,
      writeMem = true,
    } = opts;
    if (store == null) {
      store = new GuidStore({
        storeName: opts.storeName || 'memo',
        storePath: opts.storePath,
        suffix: this.suffix,
        logger,
      });
    }
    Object.assign(this, {
      deserialize,
      fileReads: 0,
      fileWrites: 0,
      logger,
      readFile: readFile == null ? writeFile : readFile,
      serialize,
      store,
      suffix,
      writeFile,
      writeMem,
    });
  }

  static serialize(obj) {
    return JSON.stringify(obj, null, 2);
  }

  static deserialize(json) {
    return JSON.parse(json);
  }

  get({ guid, volume = this.store.volume }) {
    const msg = 'MemoCache.get() ';
    let { map } = this;
    let readFile = this.isFlag(this.readFile);
    let writeMem = this.isFlag(this.writeMem);
    let writeFile = this.isFlag(this.writeFile);
    if (guid == null) {
      throw new Error('guid expected');
    }
    map[volume] = map[volume] || {};
    let mapVolume = map[volume];
    let value = mapVolume[guid];
    if (value == undefined) {
      let fpath = this.store.guidPath({ guid, volume });
      if (readFile && fs.existsSync(fpath)) {
        try {
          let data = fs.readFileSync(fpath).toString();
          this.fileReads++;
          let json = this.deserialize(data);
          value = json.isPromise
            ? Promise.resolve(json.value)
            : json.value;
          if (writeMem) {
            mapVolume[guid] = value;
          }
        } catch (e) {
          this.error(`get(`, { guid, volume }, ')', e.message);
        }
      }
    } else {
      let fpath = this.store.guidPath({ guid, volume });

      // Touch file
      if (writeFile && fs.existsSync(fpath)) {
        let atime = new Date();
        let mtime = atime;
        fs.utimesSync(fpath, atime, mtime);
      }
    }
    return value;
  }

  isFlag(flag) {
    return typeof flag === 'function' ? flag() : flag === true;
  }

  put({ guid, args, volume = this.store.volume, value }) {
    const msg = 'm7e.put:';
    const dbg = DBG.M7E_PUT;
    let { logger, map } = this;
    map[volume] = map[volume] || {};
    let mapVolume = map[volume];
    let writeMem = this.isFlag(this.writeMem);
    let writeFile = this.isFlag(this.writeFile);

    if (writeMem) {
      mapVolume[guid] = value;
    }
    let fpath = this.store.guidPath({ guid, volume });
    let isPromise = value instanceof Promise;
    if (writeFile) {
      let cacheValue = {
        isPromise,
        volume,
        args,
        value,
      };
      dbg && logger.info(msg, '[1]writeFile', fpath);
      if (isPromise) {
        let promise = value;
        value = (async () => {
          let actualValue = await promise;
          cacheValue.value = actualValue;
          let json = this.serialize(cacheValue);
          logger.info(
            msg,
            '[2]put',
            `put(${volume},${guid}) async`,
            `args:${JSON.stringify(args)}`,
            `writeFileSync:${json.length}`,
          );
          // We can't use async writeFile here because
          // we want to block all reads on the file
          // until it is written
          fs.writeFileSync(fpath, json);
          this.fileWrites++;
          return actualValue;
        })();
      } else {
        let json = this.serialize(cacheValue);
        logger.info(
          msg,
          '[3]put',
          `put(${volume},${guid}) sync`,
          `args:${JSON.stringify(args)}`,
          `writeFileSync:${json.length}`,
        );
        fs.writeFileSync(fpath, json);
        this.fileWrites++;
      }
    }
    return value;
  }

  volumes() {
    let writeMem = this.isFlag(this.writeMem);
    let writeFile = this.isFlag(this.writeFile);

    if (writeMem) {
      return Object.keys(this.map);
    }
    if (writeFile) {
      return fs.readdirSync(this.store.storePath);
    }
    return [];
  }

  async clearVolume(volume = this.store.volume) {
    const msg = 'm7e.clearVolume:';
    let { logger } = this;
    try {
      logger.info(msg, '[1]volume', volume);
      delete this.map[volume];
      await this.store.clearVolume(volume);
    } catch (e) {
      logger.error(msg, '[2]error', e.message);
      throw e;
    }
  }

  async fileSize() {
    const msg = 'm7e.fileSize:';
    let { logger } = this;
    try {
      let root = this.store.storePath;
      let bytes = 0;
      for await (let f of Files.files({ root, stats: true })) {
        bytes += f.stats.size;
      }
      return bytes;
    } catch (e) {
      logger.error(msg, '[1]error', e.message);
      throw e;
    }
  }
}
