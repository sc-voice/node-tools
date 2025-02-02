import fs from 'node:fs';
import path from 'node:path';
import should from 'should';
import { MemoAgain } from '../../index.mjs';
const { GuidStore } = MemoAgain;
import { Text } from '@sc-voice/tools';
const { MerkleJson } = Text;
const { dirname: __dirname, filename: __filename } = import.meta;

describe('TESTTESTguid-store', () => {
  const APP_DIR = path.join(__dirname, '../..');
  const SRC_DIR = path.join(APP_DIR, 'src');
  const FILES_DIR = path.join(APP_DIR, 'test', 'data', 'files');
  const LOCAL_DIR = path.join(APP_DIR, 'local');
  let mj = new MerkleJson();

  it('default ctor', () => {
    let store = new GuidStore();
    should(store.storePath).equal(path.join(LOCAL_DIR, 'guid-store'));
    should(fs.existsSync(store.storePath)).equal(true);
  });
  it('custom ctor', () => {
    let store = new GuidStore({
      type: 'SoundStore',
      storeName: 'sounds',
    });
    should(store.storePath).equal(path.join(LOCAL_DIR, 'sounds'));
    should(store.volume).equal('common');
    should(fs.existsSync(store.storePath)).equal(true);
  });
  it('guidPath(guid) returns file path of guid', () => {
    let store = new GuidStore();
    let guid = mj.hash('hello world');
    let guidDir = guid.substring(0, 2);
    let commonPath = path.join(
      LOCAL_DIR,
      'guid-store',
      'common',
      guidDir,
    );
    let dirPath = path.join(commonPath, guid);
    should(store.guidPath(guid, '.gif')).equal(`${dirPath}.gif`);

    // volume and chapter can be specified
    let volume = 'test-volume';
    let chapter = 'test-chapter';
    let suffix = '.json';
    let opts = {
      volume,
      chapter,
      suffix,
    };
    let chapterPath = path.join(
      LOCAL_DIR,
      'guid-store',
      volume,
      chapter,
    );
    let id = 'tv-tc-1.2.3';
    let idPath = path.join(chapterPath, `${id}${suffix}`);
    should(store.guidPath(id, opts)).equal(idPath);
  });
  it('signaturePath(signature) => file path of signature', () => {
    let store = new GuidStore();
    let guid = mj.hash('hello world');
    let guidDir = guid.substring(0, 2);
    let dirPath = path.join(
      LOCAL_DIR,
      'guid-store',
      'common',
      guidDir,
    );
    let sigPath = path.join(dirPath, guid);
    let signature = {
      guid,
    };
    should(store.signaturePath(signature, '.txt')).equal(
      `${sigPath}.txt`,
    );

    store = new GuidStore({
      type: 'SoundStore',
      storeName: 'sounds',
      suffix: '.ogg',
    });
    guid = mj.hash('hello world');
    let commonPath = path.join(
      LOCAL_DIR,
      'sounds',
      'common',
      guidDir,
    );
    sigPath = path.join(commonPath, guid);
    let expectedPath = `${sigPath}.ogg`;
    signature = {
      guid,
    };
    should(store.signaturePath(signature)).equal(expectedPath);
  });
  it('clearVolume() removes files in volume', async () => {
    let store = new GuidStore();

    let fDel1 = store.guidPath({
      guid: 'del1',
      volume: 'clear',
    });
    fs.writeFileSync(fDel1, 'delete-me');
    let fDel2 = store.guidPath({
      guid: 'del2',
      volume: 'clear',
    });
    fs.writeFileSync(fDel2, 'delete-me');
    let fSave = store.guidPath({
      guid: '54321',
      volume: 'save',
    });
    fs.writeFileSync(fSave, 'save-me');

    // Only delete files in volume
    should(fs.existsSync(fDel1)).equal(true);
    should(fs.existsSync(fDel2)).equal(true);
    should(fs.existsSync(fSave)).equal(true);
    let count = await store.clearVolume('clear');
    should(count).equal(2);
    should(fs.existsSync(fDel1)).equal(false);
    should(fs.existsSync(fDel2)).equal(false);
    should(fs.existsSync(fSave)).equal(true);
  });
});
