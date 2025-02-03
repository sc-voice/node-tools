import fs from 'node:fs';
import path from 'node:path';
import { Text } from '@sc-voice/tools';
import should from 'should';
const { Logger, MerkleJson } = Text;
const { dirname: __dirname, filename: __filename } = import.meta;
const APP_DIR = path.join(__dirname, '../..');
const LOCAL = path.join(APP_DIR, 'local');
import { MemoAgain } from '../../index.mjs';
const { MemoCache, Memoizer } = MemoAgain;
let logger = new Logger({ sink: null }); // suppress console for tests

describe('memoizer', function () {
  this.timeout(5 * 1000);
  const CONTEXT = 'test';
  const STORENAME = 'test-memo';

  class TestCache {
    constructor() {
      this.map = {};
    }

    get({ guid, volume = 'common' }) {
      let key = `${guid}-${volume}`;
      return this.map[key];
    }

    put({ guid, volume = 'common', value }) {
      let key = `${guid}-${volume}`;
      this.map[key] = value;
    }
  }

  it('default ctor', () => {
    let mzr = new Memoizer();
    should(mzr.storeName).equal('memo');
    should(mzr.storePath).equal(`${LOCAL}/memo`);

    should(mzr.cache).instanceOf(MemoCache);
    should(mzr.cache.writeMem).equal(true);
    should(mzr.cache.writeFile).equal(true);
    should(mzr.cache.readFile).equal(true);
    should(mzr.cache.store.storeName).equal('memo');
    should(mzr.cache.store.storePath).equal(`${LOCAL}/memo`);
  });
  it('custom ctor', () => {
    let cache = new TestCache();
    let mzr = new Memoizer({ cache, logger });
    should(mzr.cache).equal(cache);

    let storePath = path.join(LOCAL, `custom`, `here`);
    mzr = new Memoizer({ storePath, logger });
    should(mzr.cache.store.storePath).equal(storePath);
    should(fs.existsSync(storePath)).equal(true);

    mzr = new Memoizer({ writeMem: false, logger });
    should(mzr.cache.writeMem).equal(false);
    should(mzr.cache.writeFile).equal(true);
    should(mzr.cache.readFile).equal(true);

    mzr = new Memoizer({ writeFile: false, logger });
    should(mzr.cache.writeMem).equal(true);
    should(mzr.cache.writeFile).equal(false);
    should(mzr.cache.readFile).equal(false);

    mzr = new Memoizer({ readFile: false, logger });
    should(mzr.cache.writeMem).equal(true);
    should(mzr.cache.writeFile).equal(true);
    should(mzr.cache.readFile).equal(false);

    let storeName = 'test-memo';
    mzr = new Memoizer({ storeName, logger });
    should(mzr.cache.store.storeName).equal(storeName);
  });
  it('memoizer stores non-promise results', async () => {
    let mzr = new Memoizer({ storeName: STORENAME, logger });
    mzr.logLevel = 'info';

    // memoize function
    let f1 = (arg) => `${arg}-41`;
    let m1 = mzr.memoize(f1, CONTEXT);
    should(m1('test')).equal('test-41');
    should(m1('test')).equal('test-41');

    // memoize arrow function
    let f2 = (arg) => `${arg}-42`;
    let m2 = mzr.memoize(f2, CONTEXT);
    should(m2('test')).equal('test-42');
    should(m2('test')).equal('test-42');

    // memoize class method
    let calls = 0;
    class TestClass {
      static someMethod(arg) {
        calls++;
        return `${arg}-43`;
      }
    }
    let tst = new TestClass();
    await mzr.clearMemo(TestClass.someMethod, TestClass);
    let m3 = mzr.memoize(TestClass.someMethod, TestClass);
    should(m3('test')).equal('test-43');
    should(calls).equal(1);
    should(m3('test')).equal('test-43');
    should(calls).equal(1);
  });
  it('memoizer stores promise results', async () => {
    const DELAY = 100;
    let mzr = new Memoizer({ logger });
    let fp = async (arg) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve(`${arg}-42`);
        }, DELAY);
      });
    await mzr.clearMemo(fp, CONTEXT);
    let m = mzr.memoize(fp, CONTEXT);

    let ms0 = Date.now();
    let p = m('test');
    should(p).instanceOf(Promise);
    should(await p).equal('test-42');
    let FUDGE = 2;
    should(Date.now() - ms0).above(DELAY - FUDGE);

    let ms1 = Date.now();
    should(await m('test')).equal('test-42');
    should(Date.now() - ms1)
      .above(-1)
      .below(DELAY);
  });
  it('volumeOf(...)=>volume name', () => {
    class TestClass {
      static staticMethod(arg) {
        return 'a static method';
      }

      instanceMethod(arg) {
        // DO NOT MEMOIZE INSTANCE METHODS
      }
    }
    let mzr = new Memoizer({ logger });
    let fun = () => 'fun!';
    let tst = new TestClass();
    should(mzr.volumeOf(() => true)).equal('global.lambda');
    should(mzr.volumeOf(fun, 'Polygon')).equal('Polygon.fun');
    should(mzr.volumeOf(TestClass.staticMethod, TestClass)).equal(
      'TestClass.staticMethod',
    );
  });
  it('custom serialization', async () => {
    let lastSerialized;
    class TestClass {
      constructor(opts = {}) {
        this.answer = opts.answer || 0;
      }

      static serialize(obj) {
        lastSerialized = JSON.stringify(obj);
        return lastSerialized;
      }

      static deserialize(obj) {
        let cached = JSON.parse(obj);
        cached.value = new TestClass(cached.value);
        return cached;
      }
    }
    let add1 = (x) => new TestClass({ answer: x + 1 });
    let mzr = new Memoizer({
      serialize: TestClass.serialize,
      deserialize: TestClass.deserialize,
      writeMem: false,
      logger,
    });
    await mzr.clearMemo(add1, 'test');
    let add1Memo = mzr.memoize(add1, CONTEXT);
    let ans = add1Memo(42);
    should(lastSerialized).equal(
      JSON.stringify({
        isPromise: false,
        volume: 'test.add1',
        args: [42],
        value: { answer: 43 },
      }),
    );
    let expected = new TestClass({ answer: 43 });
    should.deepEqual(add1Memo(42), expected); // computed
    await new Promise((r) => setTimeout(r, 100));
    should.deepEqual(add1Memo(42), expected); // cached
  });
});
