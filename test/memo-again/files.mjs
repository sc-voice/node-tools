import fs from 'node:fs';
import path from 'node:path';
import should from 'should';
import { MemoAgain } from '../../index.mjs';
const { Files, GuidStore } = MemoAgain;

const { dirname: __dirname, filename: __filename } = import.meta;
import { Text } from '@sc-voice/tools';
const { MerkleJson } = Text;

describe('files', () => {
  const APP_DIR = path.join(__dirname, '../..');
  const SRC_DIR = path.join(APP_DIR, 'src');
  const FILES_DIR = path.join(APP_DIR, 'test', 'data', 'files');
  const LOCAL_DIR = path.join(APP_DIR, 'local');
  let mj = new MerkleJson();

  it('filesSync(root) => generator', () => {
    // Specify root path
    let files = [...Files.filesSync(FILES_DIR)];
    should.deepEqual(files, ['universe', 'sub/basement', 'hello']);

    // Default is source folder
    files = [...Files.filesSync()];
    should.deepEqual(files, [
      'memoizer.mjs',
      'memo-cache.mjs',
      'guid-store.mjs',
      'files.mjs',
      'file-pruner.mjs',
    ]);
  });
  it('localPath()', () => {
    const msg = 'tf3s.localPath:';
    should(Files.localPath()).equal(LOCAL_DIR);
    should(
      Files.localPath(
        '/a/b/c/node_modules/@sc-voice/node-tools/src/memo-again/files.mjs',
      ),
    ).equal('/a/b/c/local');
    should(Files.localPath('/a/b/c/src/memo-again/files.mjs')).equal(
      '/a/b/c/local',
    );
  });
  it('filesSync(root) => absolute path', () => {
    // absolute path
    let files = [
      ...Files.filesSync({ root: FILES_DIR, absolute: true }),
    ];
    should.deepEqual(
      files.map((f) => f.replace(APP_DIR, '...')),
      [
        '.../test/data/files/universe',
        '.../test/data/files/sub/basement',
        '.../test/data/files/hello',
      ],
    );

    // absolute path undefined
    files = [...Files.filesSync({ absolute: true })];
    should.deepEqual(
      files.map((f) => f.replace(APP_DIR, '...')),
      [
        '.../src/memo-again/memoizer.mjs',
        '.../src/memo-again/memo-cache.mjs',
        '.../src/memo-again/guid-store.mjs',
        '.../src/memo-again/files.mjs',
        '.../src/memo-again/file-pruner.mjs',
      ],
    );
  });
  it('filesSync(root) => stats', () => {
    let files = [
      ...Files.filesSync({ root: FILES_DIR, stats: true }),
    ];
    should.deepEqual(
      files.map((f) => f.path.replace(APP_DIR, '...')),
      ['universe', 'sub/basement', 'hello'],
    );
    should.deepEqual(
      files.map((f) => f.stats.size),
      [9, 13, 6],
    );
  });
  it('files(root) => async generator', async () => {
    // The async generator has best performance
    // but Javascript does not yet support spread syntax
    let files = [];
    for await (let f of Files.files(FILES_DIR)) {
      files.unshift(f);
    }
    should.deepEqual(files, ['hello', 'sub/basement', 'universe']);
  });
});
