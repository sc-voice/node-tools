import fs from 'node:fs';
import path from 'node:path';
import { Text } from '@sc-voice/tools';
import should from 'should';
const { Logger, MerkleJson } = Text;

const { dirname: __dirname, filename: __filename } = import.meta;
const APP_DIR = path.join(__dirname, '../..');

import { MemoAgain } from '../../index.mjs';
const { Files, GuidStore, MemoCache } = MemoAgain;
let logger = new Logger({ sink: null }); // suppress console for tests

describe('TESTTESTmemo-cache', () => {
  const SRC_DIR = path.join(APP_DIR, 'src');
  const FILES_DIR = path.join(APP_DIR, 'test', 'data', 'files');
  const LOCAL_DIR = path.join(APP_DIR, 'local');
  const TEST_DIR = path.join(LOCAL_DIR, 'test');

  let mj = new MerkleJson();
  let TEST_STORE = new GuidStore({
    storePath: TEST_DIR,
    suffix: '.json',
  });

  it('default ctor', () => {
    let mc = new MemoCache();
    should(mc).properties({
      map: {},
    });
    should(mc.store).instanceOf(GuidStore);
    should(mc.store.storePath).equal(path.join(LOCAL_DIR, 'memo'));
    should(mc.writeMem).equal(true);
    should(mc.writeFile).equal(true);
    should(mc.readFile).equal(true);
  });
  it('custom ctor', () => {
    let store = new GuidStore();
    let writeMem = () => false;
    let writeFile = () => false;
    let readFile = () => false;
    let mc = new MemoCache({
      store,
      writeMem,
      writeFile,
      readFile,
    });
    should(mc).properties({
      map: {},
      store,
      writeMem,
      writeFile,
      readFile,
    });
    should(mc.store).equal(store);
  });
  it('put(...) adds cache entry', async () => {
    let mc = new MemoCache({ store: TEST_STORE, logger });
    let guid = 'guid1';
    let volume = 'volume1';
    let value = 'value1';
    let res = mc.put({ guid, volume, value });
    should(mc.map.volume1.guid1).equal(value);
    should(res).equal(value);
  });
  it('writeMem suppresses memory cache', async () => {
    let mc = new MemoCache({
      store: TEST_STORE,
      writeMem: false, // only use file cache
      logger,
    });
    let guid = 'guid1';
    let volume = 'volume1';
    let value = 'value1';
    let res = mc.put({ guid, volume, value });
    should(mc.map.volume1.guid1).equal(undefined);
    should(res).equal(value);
    should(mc.get({ guid, volume })).equal(value); // file cache
    should(mc.map.volume1.guid1).equal(undefined);

    let mc2 = new MemoCache({
      store: TEST_STORE,
    });
    should(mc2.get({ guid, volume })).equal(value); // file cache
  });
  it('get(...) retrieves cache entry', () => {
    let mc = new MemoCache({ store: TEST_STORE, logger });
    let guid = 'guid2';
    let volume = 'volume2';
    let value = 'value2';
    mc.put({ guid, volume, value });
    should.deepEqual(mc.get({ guid, volume }), value);
  });
  it('get(...) retrieves serialized cache entry', async () => {
    let mc = new MemoCache({ store: TEST_STORE, logger });
    let guid = 'guid3';
    let volume = 'volume3';
    let value = 'value3';
    mc.put({ guid, volume, value }); // wait for file write

    // New cache instance remembers
    let mc2 = new MemoCache({ store: mc.store });
    should.deepEqual(mc2.get({ guid, volume }), value);
  });
  it('get/put handle Promises', async () => {
    let mc = new MemoCache({ store: TEST_STORE, logger });
    let guid = 'guid4';
    let volume = 'volume4';
    let value = new Promise((r) =>
      setTimeout(() => r('value4'), 100),
    );
    let fpath = mc.store.guidPath({ guid, volume });
    await mc.clearVolume(volume); // Clear for testing

    // file cache will be written when value is resolved
    let promise = mc.put({ guid, volume, value });
    should(fs.existsSync(fpath)).equal(false);

    // wait for file cache
    let pval = await promise; // wait for file write
    should(fs.existsSync(fpath)).equal(true);
    should(pval).equal(await value);
    should(mc.logger.history.at(-1).text).match(
      /put\(volume4,guid4\)/,
    );

    // New cache will reuse saved values
    let mc2 = new MemoCache({ store: mc.store });
    let v2 = mc2.get({ guid, volume });
    should(v2).instanceOf(Promise);
    should(await v2).equal('value4');
    should(mc2.map[volume][guid]).equal(v2); // in memory map
  });
  it('clearVolume() clears cache', async () => {
    let mc = new MemoCache({ store: TEST_STORE, logger });
    let guid = 'guid5';
    let volume = 'volume5';
    let value = 'value5';
    await mc.clearVolume(volume); // Clear for testing
    should(mc.logger.history.at(-1).text).match(
      /clearVolume.*volume5/,
    );

    mc.put({ guid, volume, value }); // deleted value
    mc.put({ guid: 'guid6', volume: 'volume6', value: 'value6' });
    should(mc.map[volume][guid]).equal(value);
    let fpath = mc.store.guidPath({ guid, volume });
    should(fs.existsSync(fpath)).equal(true);

    await mc.clearVolume(volume);
    should(mc.map[volume]).equal(undefined);
    should(fs.existsSync(fpath)).equal(false);
    should(mc.get({ guid: 'guid6', volume: 'volume6' })).equal(
      'value6',
    );
  });
  it('get(...) touches serialized cache entry', async () => {
    let mc = new MemoCache({
      store: TEST_STORE,
      writeMem: false,
      logger,
    });
    let guid = 'guid7';
    let volume = 'volume7';
    let value = 'value7';
    should(mc).properties({ fileReads: 0, fileWrites: 0 });
    mc.put({ guid, volume, value }); // wait for file write
    should(mc).properties({ fileReads: 0, fileWrites: 1 });
    let fpath = mc.store.guidPath({ guid, volume });
    await new Promise((r) => setTimeout(() => r(), 100));

    mc.get({ guid, volume }); // touch
    should(mc).properties({ fileReads: 1, fileWrites: 1 });
  });
  it('writeFile suppresses file cache', async () => {
    let mc = new MemoCache({
      store: TEST_STORE,
      writeFile: false, // only use memory cache
      logger,
    });
    let guid = 'guid8';
    let volume = 'volume8';
    let value = 'value8';
    await mc.clearVolume(volume);
    mc.put({ guid, volume, value }); // wait for file write

    // Original cache instance remembers
    should.deepEqual(mc.get({ guid, volume }), value); // memory

    // New cache instance doesn't remember
    let mc2 = new MemoCache({ store: mc.store });
    should.deepEqual(mc2.get({ guid, volume }), undefined);
  });
  it('writeMem and writeFile can be functions', async () => {
    let write;
    let mc = new MemoCache({
      store: TEST_STORE,
      writeMem: () => write,
      writeFile: () => write,
      logger,
    });
    let guid = 'guid9';
    let volume = 'volume9';
    let value = 'value9';
    mc.clearVolume(volume);

    write = false;
    should(mc.isFlag(mc.writeMem)).equal(false);
    should(mc.isFlag(mc.writeFile)).equal(false);
    mc.put({ guid, volume, value }); // wait for file write
    should.deepEqual(mc.get({ guid, volume }), undefined);

    write = true;
    should(mc.isFlag(mc.writeMem)).equal(true);
    should(mc.isFlag(mc.writeFile)).equal(true);
    mc.put({ guid, volume, value }); // wait for file write
    should.deepEqual(mc.get({ guid, value }), undefined);
  });
  it('volumes() => [volumeNames]', async () => {
    let mc = new MemoCache({
      store: TEST_STORE,
      writeMem: true,
      writeFile: false,
      logger,
    });
    let guid = 'guid10';
    let volume = 'volume10';
    let value = 'value10';
    mc.put({ guid, volume, value }); // wait for file write
    should(mc.volumes().find((v) => v === volume)).equal(volume);

    mc = new MemoCache({
      store: TEST_STORE,
      writeMem: false,
      writeFile: true,
      logger,
    });
    guid = 'guid11';
    volume = 'volume11';
    value = 'value11';
    mc.put({ guid, volume, value }); // wait for file write
    should(mc.volumes().find((v) => v === volume)).equal(volume);
  });
  it('fileSize() => total file size', async () => {
    let mc = new MemoCache({
      store: TEST_STORE,
      logger,
    });
    let guid = 'guid12';
    let volume = 'volume12';
    let value = 'value12';
    await mc.clearVolume(volume);
    let bytesBefore = await mc.fileSize();
    mc.put({ guid, volume, value }); // wait for file write
    let bytesAfter = await mc.fileSize();
    should(bytesAfter - bytesBefore).equal(70);
  });
  it('readFile can disable file cache read', async () => {
    let store = TEST_STORE;
    let mc = new MemoCache({ store, writeMem: false, logger });
    let guid = 'guid13';
    let volume = 'volume13';
    let value = 'value13';
    mc.put({ guid, volume, value }); // wait for file write
    should(mc.get({ guid, volume })).equal(value);

    let mcNoRead = new MemoCache({ store, readFile: false });
    should(mcNoRead.get({ guid, volume })).equal(undefined);
  });
});
