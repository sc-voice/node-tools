import fs from 'node:fs';
import path from 'node:path';
const { dirname: __dirname, filename: __filename } = import.meta;
const APP_DIR = path.join(__dirname, '../..');
const LOCAL_DIR = path.join(APP_DIR, 'local');
import { Files } from './files.mjs';

export class GuidStore {
  constructor(opts = {}) {
    this.type = opts.type || 'GuidStore';
    this.folderPrefix = opts.folderPrefix || 2;

    this.suffix = opts.suffix || '';
    this.volume = opts.volume || 'common';
    this.storeName = opts.storeName || 'guid-store';

    // Unserialized properties
    let storePath =
      opts.storePath || path.join(LOCAL_DIR, this.storeName);
    Object.defineProperty(this, 'storePath', {
      value: storePath,
    });
    fs.mkdirSync(storePath, { recursive: true });
  }

  guidPath(...args) {
    let opts;
    if (args[0] === Object(args[0])) {
      // (opts); (opts1,opts2)
      opts = Object.assign({}, args[0], args[1]);
    } else if (args[1] === Object(args[1])) {
      // (guid, opts)
      opts = Object.assign(
        {
          guid: args[0],
        },
        args[1],
      );
    } else {
      // (guid, suffix)
      opts = {
        guid: args[0],
        suffix: args[1],
      };
    }

    // set up volume folder
    let volume = opts.volume || this.volume;
    let volumePath = path.join(this.storePath, volume);
    fs.existsSync(volumePath) || fs.mkdirSync(volumePath);

    // set up chapter folder
    let guid = opts.guid;
    let chapter = opts.chapter || guid.substr(0, this.folderPrefix);
    let chapterPath = path.join(this.storePath, volume, chapter);
    fs.existsSync(chapterPath) || fs.mkdirSync(chapterPath);

    // define path
    let suffix = opts.suffix == null ? this.suffix : opts.suffix;
    return path.join(chapterPath, `${guid}${suffix}`);
  }

  signaturePath(sigObj, opts) {
    let guidOpts = Object.assign({}, sigObj);
    if (opts === Object(opts)) {
      Object.assign(guidOpts, opts);
    } else if (typeof opts === 'string') {
      guidOpts.suffix = opts;
    }
    return this.guidPath(guidOpts);
  }

  async clearVolume(volume = this.volume) {
    let count = 0;
    let root = path.join(this.storePath, volume);
    if (fs.existsSync(root)) {
      for await (let fname of Files.files({ root, absolute: true })) {
        await fs.promises.unlink(fname);
        count++;
      }
    }
    return count;
  }
}
