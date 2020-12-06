import { Reactor, just } from '../inc.js';
import * as assert from 'assert';

describe("incr", function() {
  describe("watchers", function() {
    it("Should trigger when vars change", function() {
      const r = new Reactor();
      const v = r.newVar(0);
      let last = 0;
      v.observe().watch(x => {
        last = x;
        return true;
      })
      v.set(2);
      r.stabilize();
      assert.equal(last, 2);
      v.set(4)
      r.stabilize();
      assert.equal(last, 4);
    });
    it("Should trigger at least once.", function() {
      const r = new Reactor();
      const v = r.newVar(0);
      let seen = false;
      v.observe().watch(_x => {
        seen = true;
        return true;
      });
      r.stabilize();
      assert.equal(seen, true);
    });
    it("Should be disabled when they return false", function() {
      const r = new Reactor();
      let last = 0;
      const v = r.newVar(last);
      v.observe().watch(x => {
        last = x;
        return false;
      });
      v.set(1);
      r.stabilize();
      assert.equal(last, 1);
      v.set(2);
      r.stabilize();
      assert.equal(last, 1);
    });
  });
  describe(".map()", function() {
    it("should trigger observers", function() {
      const r = new Reactor();
      let last = 0;
      const v = r.newVar(last);
      v.map(x => x + 1).observe().watch(x => {
        last = x;
        return true;
      });
      v.set(1);
      r.stabilize();
      assert.equal(last, 2);
      v.set(7);
      r.stabilize();
      assert.equal(last, 8);
    });
  });
  describe(".then()", function() {
    it("should trigger observers", function() {
      const r = new Reactor();
      const v = r.newVar(0);
      let last = 0;
      v.then(x => just(x + 1)).observe().watch(x => {
        last = x;
        return true;
      })
      v.set(1);
      r.stabilize();
      assert.equal(last, 2);
      v.set(5);
      r.stabilize();
      assert.equal(last, 6);
    })
  });
  describe("misc", function() {
    it("Should compute the right value for a slightly more complicated example", function() {
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
});
