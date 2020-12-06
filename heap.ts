
function iparent(i: number): number { return (i - 1) >> 1 }
function ileft(i: number): number { return (i << 1) + 1 }
function iright(i: number): number { return (i << 1) + 2 }

export class Heap<T> {
  private _before: (x: T, y: T) => boolean
  private _items: T[];

  constructor(before: (x: T, y: T) => boolean) {
    this._items = [];
    this._before = before;
  }

  empty(): boolean {
    return this._items.length === 0;
  }

  push(item: T): void {
    this._items.push(item);
    this._percolate_up(this._items.length - 1);
  }

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
