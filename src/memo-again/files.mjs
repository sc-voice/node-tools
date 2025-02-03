import fs from 'node:fs';
import path from 'node:path';
const { dirname: __dirname, filename: __filename } = import.meta;

export class Files {
  static *filesSync(arg) {
    let opts = typeof arg === 'string' ? { root: arg } : arg || {};
    let root = opts.root || __dirname;
    let stats = opts.stats;
    let absolute = opts.absolute;
    root = root.replace('/$', ''); // normalize
    let stack = [root];
    let reRoot = new RegExp(`^${root}/`);
    while (stack.length) {
      let fpath = stack.pop();
      if (fs.existsSync(fpath)) {
        Files.found++;
        let fstats = fs.statSync(fpath);
        if (fstats.isDirectory()) {
          fs.readdirSync(fpath).forEach((dirEntry) => {
            stack.push(path.join(fpath, dirEntry));
          });
        } else if (fstats.isFile()) {
          let ypath = absolute ? fpath : fpath.replace(reRoot, '');
          yield stats ? { stats: fstats, path: ypath } : ypath;
        }
      }
    }
  }

  static localPath(aPath = __dirname) {
    const msg = 'f3s.localPath:';
    let dirParts = aPath.split('/');
    let iSrc = dirParts.findLastIndex((e) => e == 'src');
    if (iSrc >= 0) {
      dirParts = dirParts.slice(0, iSrc);
    }
    let iNodeModules = dirParts.findLastIndex(
      (e) => e == 'node_modules',
    );
    if (iNodeModules >= 0) {
      dirParts = dirParts.slice(0, iNodeModules);
    }
    dirParts.push('local');
    let local = dirParts.join('/');
    return local;
  }

  static async *files(arg) {
    let opts = typeof arg === 'string' ? { root: arg } : arg || {};
    let root = opts.root || __dirname;
    let stats = opts.stats;
    let absolute = opts.absolute;
    root = root.replace('/$', ''); // normalize
    let stack = [root];
    let reRoot = new RegExp(`^${root}/`);
    while (stack.length) {
      let fpath = stack.pop();
      if (!fs.existsSync(fpath)) {
        continue;
      }

      Files.found++;
      let fstats = await fs.promises.stat(fpath);
      if (fstats.isDirectory()) {
        let entries = await fs.promises.readdir(fpath);
        entries.forEach((dirEntry) => {
          stack.push(path.join(fpath, dirEntry));
        });
      } else if (fstats.isFile()) {
        let ypath = absolute ? fpath : fpath.replace(reRoot, '');
        yield stats ? { stats: fstats, path: ypath } : ypath;
      }
    }
  }
}
