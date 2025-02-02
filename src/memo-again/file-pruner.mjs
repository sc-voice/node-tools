import fs from 'node:fs';
import path from 'node:path';
import { DBG } from '../defines.mjs';
import { Files } from './files.mjs';
const MS_MINUTE = 60 * 1000;
const MS_DAY = 24 * 60 * MS_MINUTE;
const PRUNE_DAYS = 180;

let instances = 0;

export class FilePruner {
  constructor(opts = {}) {
    const msg = 'f84.ctor:';
    // options
    this.name = `${this.constructor.name}_${++instances}`;
    if (!fs.existsSync(opts.root)) {
      throw new Error(`${msg} exists root? ${opts.root}`);
    }
    this.root = opts.root;
    this.pruneDays = opts.pruneDays || PRUNE_DAYS;
    this.onPrune = opts.onPrune || FilePruner.onPrune;
    this.logger = opts.logger || console;

    // instance
    this.started = undefined;
    this.done = undefined;
    this.earliest = undefined;
    this.pruning = 0;
    this.bytesScanned = 0;
    this.bytesPruned = 0;
    this.filesPruned = 0;
  }

  static onPrune(oldPath, stats) {
    return true;
  }

  async pruneOldFiles(onPrune = this.onPrune) {
    const msg = 'f8r.pruneOldFiles:';
    const dbg = DBG.F8R_ON_PRUNE;
    let { logger } = this;
    try {
      let { root, pruning } = this;
      if (pruning) {
        throw new Error(`${msg} ignored (busy)`);
      }
      this.pruning = 1;
      let pruneDays = this.pruneDays || 180;
      this.started = new Date();
      this.bytesScanned = 0;
      this.bytesPruned = 0;
      this.earliest = Date.now();
      let pruneDate = new Date(Date.now() - pruneDays * MS_DAY);
      dbg && logger.log(msg, '[1]started', this.started);
      let pruneOpts = { root, stats: true, absolute: true };
      this.pruning = 1;
      let filesPruned = 0;
      let bytesPruned = 0;
      let bytesScanned = 0;
      for await (let f of Files.files(pruneOpts)) {
        let { stats, path: fpath } = f;
        bytesScanned += stats.size;
        this.bytesScanned += stats.size;
        if (stats.mtime < this.earliest) {
          this.earliest = stats.mtime;
        }
        if (stats.mtime <= pruneDate) {
          if (await onPrune(fpath, stats)) {
            // qualified delete
            filesPruned++;
            this.filesPruned++;
            logger.log(msg, '[1]prune', fpath);
            await fs.promises.unlink(fpath);
            bytesPruned += stats.size;
            this.bytesPruned += stats.size;
          }
        }
      }
      this.pruning = 0;
      this.done = new Date();
      let elapsed = ((this.done - this.started) / 1000).toFixed(1);
      logger.log(msg, '[2]done', `${elapsed}s`);
      return {
        started: this.started,
        earliest: this.earliest,
        done: this.done,
        bytesScanned,
        bytesPruned,
        filesPruned,
        pruning: this.pruning,
      };
    } catch (e) {
      logger.error(msg, '[3]error', e.message);
      throw e;
    }
  }
}
