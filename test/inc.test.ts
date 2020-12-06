import { Reactor } from '../inc.js';
import * as assert from 'assert';

describe("incr", function() {
  it("should compute the right value", function() {
    const r = new Reactor();
    const x = r.newVar(1);
    const y = r.newVar(2);
    const z = x.then(x => y.map(y => x + y))
    const obs = z.observe();
    let expected = 3;
    let seen = 0;
    obs.watch(actual => {
      assert.equal(expected, actual)
      seen++;
      return true;
    })
    r.stabilize();
    assert.equal(seen, 1)
    x.set(0);
    expected = 2;
    r.stabilize();
    assert.equal(seen, 2)
  })
});
