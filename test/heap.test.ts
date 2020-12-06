import { Heap } from "../heap.js";
import * as assert from 'assert';

function numBefore(x: number, y: number): boolean {
  return x < y;
}

describe("Heap", function() {
  describe(".empty()", function() {
    const h = new Heap(numBefore);
    it("should return true on an empty heap", function() {
      assert.equal(h.empty(), true);
    })
    it("should return false after adding items", function() {
      h.push(1);
      assert.equal(h.empty(), false);
    })
  })
  describe(".size()", function() {
    const h = new Heap(numBefore);
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
  describe("invariants", function() {
    it("should always return elements in priority order.", function() {
      const h = new Heap(numBefore);
      for(let i = 0; i < 10; i++) {
        h.push(Math.random());
        let prev = h.pop();
        while(!h.empty()) {
          let next = h.pop();
          assert.equal(prev === next || numBefore(prev, next), true);
          prev = next;
        }
      }
    })
  })
})
