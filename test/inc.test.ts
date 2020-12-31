import { Reactor } from '../inc.js';
import * as inc from '../inc.js';
import * as assert from 'assert';

describe("incr", function() {
  describe("watchers", function() {
    it("Should trigger once on constants", function() {
      const r = new Reactor();
      let seen = 0;
      r.const(4).observe().watch(value => {
        seen = value;
        return true;
      })
      r.stabilize();
      assert.equal(seen, 4);
    });
    it("Should trigger when vars change", function() {
      const r = new Reactor();
      const v = r.Var(0);
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
      const v = r.Var(0);
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
      const v = r.Var(last);
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
      const v = r.Var(last);
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
      const v = r.Var(0);
      let last = 0;
      v.then(x => r.const(x + 1)).observe().watch(x => {
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
    it("Should handle switching between newly created results", function() {
      const r = new Reactor();
      const v = r.Var(false);
      const res = v.then((v) => {
        if(v) {
          return r.const(1);
        } else {
          return r.const(2);
        }
      }).observe();

      r.stabilize();
      assert.equal(res.get(), 2);

      v.set(true);
      r.stabilize();
      assert.equal(res.get(), 1);

      v.set(false);
      r.stabilize();
      assert.equal(res.get(), 2);
    });
    it("Should handle switching between pre-existing results", function() {
      // This is just like the test case above, except that we allocate the two
      // possible result `Incr`s outside of then()'s argument, once.
      const r = new Reactor();

      const one = r.const(1);
      const two = r.const(2);

      const v = r.Var(false);

      const res = v.then((v) => {
        if(v) {
          return one;
        } else {
          return two;
        }
      }).observe();

      r.stabilize()
      assert.equal(res.get(), 2);

      v.set(true);
      r.stabilize();
      assert.equal(res.get(), 1);

      v.set(false);
      r.stabilize();
      assert.equal(res.get(), 2);
    });
  });
  describe("misc", function() {
    it("Should compute the right value for a slightly more complicated example", function() {
      const r = new Reactor();
      const x = r.Var(1);
      const y = r.Var(2);
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
    });
    it("...and another", function() {
      // This is meant to reproduce the dependency graph of a failure
      // I(zenhack) saw in an app... but the test passes, so it wasn't
      // the issue. Still, it's another example.
      const r = new Reactor();
      const a = r.Var('a');
      const b = r.Var('b');
      const cac = a.map(a => a + 'c').map(ac => 'c' + ac);
      const bc = b.map(b => b + 'c');
      const cacbc = inc.map2(cac, bc, (x, y) => x + y)
      let value = "";
      cacbc.observe().watch(x => {
        value = x;
        return false;
      })
      r.stabilize();
      assert.equal(value, "cacbc");
    });
  });
});
