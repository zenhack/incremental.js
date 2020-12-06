import { Heap } from "../heap.js";
import * as assert from 'assert';

describe("Heap", function() {
  describe(".empty()", function() {
    const h: Heap<number> = new Heap((x, y) => x < y);
    it("should return true on an empty heap", function() {
      assert.equal(h.empty(), true);
    })
    it("should return false after adding items", function() {
      h.push(1);
      assert.equal(h.empty(), false);
    })
  })
  describe(".size()", function() {
    const h: Heap<number> = new Heap((x, y) => x < y);
    it("should return 0 for an empty heap.", function() {
      assert.equal(h.size(), 0);
    })
    it("should return larger values after adding to the heap", function() {
      assert.equal(h.size(), 0);
      h.push(1);
      assert.equal(h.size(), 1);
      h.push(1);
      assert.equal(h.size(), 2);
      h.push(1);
      assert.equal(h.size(), 3);
    })
    it("should return smaller values after removing items", function() {
      h.pop();
      assert.equal(h.size(), 2);
      h.pop();
      assert.equal(h.size(), 1);
      h.pop();
      assert.equal(h.size(), 0);
    })
  })
})
