import fs from 'node:fs';
import path from 'node:path';
import should from 'should';
import { Text } from '@sc-voice/tools';
const { Logger } = Text;
import { MemoAgain } from '../../index.mjs';
const { dirname: __dirname, filename: __filename } = import.meta;
const logger = new Logger({sink:null}); // suppress normal output

describe('file-pruner', function () {
  const { FilePruner } = MemoAgain;
  const APP_DIR = path.join(__dirname, '../..');
  const SRC_DIR = path.join(APP_DIR, 'src');
  const TEST_DIR = path.join(APP_DIR, 'test');
  const LOCAL_DIR = path.join(APP_DIR, 'local');
  let TEST_SOUNDS = path.join(TEST_DIR, 'data', 'sounds');
  let TEST_SOUNDS2 = path.join(TEST_DIR, 'data', 'sounds2');
  this.timeout(5 * 1000);

  it('TESTTESTdefault ctor', () => {
    should.throws(() => {
      // root is required
      let fp = new FilePruner();
    });
    let root = TEST_SOUNDS;
    let fp = new FilePruner({ root });
    should(fp.pruneDays).equal(180);
    should(fp.pruning).equal(0);
    should(fp.onPrune).equal(FilePruner.onPrune);
    should(fp.started).equal(undefined);
    should(fp.done).equal(undefined);
    should(fp.bytesScanned).equal(0);
    should(fp.bytesPruned).equal(0);
    should(fp.filesPruned).equal(0);
  });
  it('custom ctor', () => {
    let root = TEST_SOUNDS;
    let onPrune = (oldPath) => false;
    let pruneDays = 100;
    let fp = new FilePruner({ root, pruneDays, onPrune});
    should(fp.pruneDays).equal(pruneDays);
    should(fp.pruning).equal(0);
    should(fp.onPrune).equal(onPrune);
    should(fp.started).equal(undefined);
    should(fp.done).equal(undefined);
  });
  it('TESTTESTpruneOldFiles() handles errors ', async () => {
    let root = TEST_SOUNDS2;
    let fp = new FilePruner({ root, logger });
    let promise = fp.pruneOldFiles();

    // Only one pruner exists at a time;
    let eCaught = null;
    try {
      await fp.pruneOldFiles();
      should.fail('Expected reject');
    } catch (e) {
      should(e.message).match(/ignored \(busy\)/);
    }
    let res = await promise;

    // Subsequent pruning is a different promise
    should(fp.pruneOldFiles()).not.equal(promise);
  });
  it('TESTTESTpruneOldFiles() ', async () => {
    let root = TEST_SOUNDS;
    let dummy1 = path.join(root, 'dummy1'); // pruned
    let dummy2 = path.join(root, 'dummy2'); // not pruned
    let dummy3 = path.join(root, 'dummy3'); // pruned
    try {
      let fp = new FilePruner({ root, logger });
      let jan1 = new Date(2020, 0, 1);
      fs.writeFileSync(dummy1, 'dummy1.json');
      try {
        // touch jan1
        fs.utimesSync(dummy1, jan1, jan1);
      } catch (err) {
        fs.closeSync(fs.openSync(dummy1, 'w'));
      }
      fs.writeFileSync(dummy2, 'dummy2');
      fs.writeFileSync(dummy3, 'dummy3.mp3');
      try {
        // touch jan1
        fs.utimesSync(dummy3, jan1, jan1);
      } catch (err) {
        fs.closeSync(fs.openSync(dummy3, 'w'));
      }

      let promise = fp.pruneOldFiles();

      let {
        filesPruned,
        bytesPruned,
        bytesScanned,
        done,
        started,
        earliest,
      } = await promise;
      should(filesPruned).equal(2);
      should(bytesScanned).equal(174138);
      should(bytesPruned).equal(21);
      should(fp).properties({
        bytesScanned: 174138,
        bytesPruned: 21,
        filesPruned: 2,
        pruning: 0,
      });
      should(earliest.toString()).equal(jan1.toString());
      should(done - started)
        .above(0)
        .below(5000);

      should(fs.existsSync(dummy1)).equal(false);
      should(fs.existsSync(dummy3)).equal(false);
    } finally {
      fs.existsSync(dummy1) && fs.unlinkSync(dummy1);
      fs.existsSync(dummy2) && fs.unlinkSync(dummy2);
      fs.existsSync(dummy3) && fs.unlinkSync(dummy3);
    }
  });
  it('TESTTESTpruneOldFiles() custom onPrune', async () => {
    let root = TEST_SOUNDS;
    let dummy1 = path.join(root, 'dummy1'); // pruned
    let dummy2 = path.join(root, 'dummy2'); // not pruned
    let dummy3 = path.join(root, 'dummy3'); // pruned
    try {
      let aug262020 = new Date(2020, 7, 26);
      const MSDAY = 24 * 3600 * 1000;
      let pruneDays = (new Date() - aug262020) / MSDAY + 1;
      let fp = new FilePruner({ root, pruneDays, logger });
      const MSTEST = 100;
      let prunable = 0;
      const onPrune = async (oldPath, stats) => {
        // custom async prune callback
        oldFiles.push(oldPath);
        prunable += stats.size;
        await new Promise((resolve) =>
          setTimeout(() => resolve(1), MSTEST),
        );
        should(fp.pruning).above(0).below(5);
        return false; // don't delete old file
      };
      let pruneDate = new Date(pruneDays * MSDAY);
      fs.writeFileSync(dummy1, 'dummy1.json');
      try {
        // touch pruneDate
        fs.utimesSync(dummy1, pruneDate, pruneDate);
      } catch (err) {
        fs.closeSync(fs.openSync(dummy1, 'w'));
      }
      fs.writeFileSync(dummy2, 'dummy2');
      fs.writeFileSync(dummy3, 'dummy3.mp3');
      try {
        // touch pruneDate
        fs.utimesSync(dummy3, pruneDate, pruneDate);
      } catch (err) {
        fs.closeSync(fs.openSync(dummy3, 'w'));
      }

      const oldFiles = [];
      let promise = fp.pruneOldFiles(onPrune);

      let res = await promise;
      should(oldFiles.length).equal(2);
      should(oldFiles[0]).match(/dummy3/);
      should(oldFiles[1]).match(/dummy1/);
      should(res.done - res.started)
        .above(2 * MSTEST)
        .below(5000);
      should(res).properties({
        bytesScanned: 174138,
        bytesPruned: 0,
        filesPruned: 0,
      });
      should(prunable).equal(21); // dummy1+dummy3 file sizes
      should(fp.pruning).equal(0);

      // nothing pruned
      should(res).properties({
        bytesScanned: 174138,
        bytesPruned: 0,
        filesPruned: 0,
      });
      should(fs.existsSync(dummy1)).equal(true);
      should(fs.existsSync(dummy2)).equal(true);
      should(fs.existsSync(dummy3)).equal(true);
    } finally {
      fs.existsSync(dummy1) && fs.unlinkSync(dummy1);
      fs.existsSync(dummy2) && fs.unlinkSync(dummy2);
      fs.existsSync(dummy3) && fs.unlinkSync(dummy3);
    }
  });
});
