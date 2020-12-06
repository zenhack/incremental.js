
export class Heap<T> {
  // A binary heap (priority queue) containing values of type <T>.

  private _before: (x: T, y: T) => boolean
  private _items: T[];

  constructor(before: (x: T, y: T) => boolean) {
    // before is a function used to determine the relative priority
    // of two elements. if `before(x, y)`, then `x` should take
    // priority over `y`.

    this._items = [];
    this._before = before;
  }

  empty(): boolean {
    // Returns whether the heap is empty.
    //
    // Running time O(1).

    return this.size() === 0;
  }

  size(): number {
    // Returns thenumber of items int he heap.
    //
    // Running time O(1).

    return this._items.length;
  }

  push(item: T): void {
    // Add an item to the heap.
    //
    // Running time O(log(n)).

    this._items.push(item);
    this._percolate_up(this._items.length - 1);
  }

  peek(): T {
    // Return the highest priority item in the heap, without returning
    // it. Throws an exception if the heap is empty.
    //
    // Running time O(1).

    if(this.empty()) {
      throw new Error("Empty heap");
    }
    return this._items[0];
  }

  // Remove and return the highest priority item in the heap.
  // Throws an exception if the heap is empty.
  //
  // Running time O(log(n)).
  pop(): T {
    if(this.empty()) {
      throw new Error("Empty heap");
    }
    const ret = this._items[0];
    this._items[0] = this._items[this._items.length - 1];
    this._items.pop();
    this._percolate_down(0)
    return ret;
  }

  _percolate_up(i: number): void {
    if(i === 0) {
      // At the root; done.
      return;
    }
    const j = iparent(i);
    if(this._less(i, j)) {
      this._swap(i, j);
      this._percolate_up(j);
    }
  }

  _percolate_down(i: number): void {
    const l = ileft(i);
    if(l >= this._items.length) {
      return;
    };
    const r = iright(i);
    let j = l;
    if(r < this._items.length && this._less(r, j)) {
      j = r;
    }
    if(this._less(j, i)) {
      this._swap(i, j);
      this._percolate_down(j);
    }
  }

  _less(i: number, j: number): boolean {
    return this._before(this._items[i], this._items[j])
  }

  _swap(i: number, j: number): void {
    const tmp = this._items[i];
    this._items[i] = this._items[j];
    this._items[j] = tmp;
  }
}

// compute indicies of parent & left & right children.
function iparent(i: number): number { return (i - 1) >> 1 }
function ileft(i: number): number { return (i << 1) + 1 }
function iright(i: number): number { return (i << 1) + 2 }
