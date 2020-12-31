import { Heap } from './heap.js';
import { Optional, notNull } from './optional.js';

let nextId = 0;

export abstract class Incr<T> {
  private _id: number;
  private _subscribers: {[k: number]: Incr<any>};
  private _rc: number = 0;
  _height: number;
  _scheduled_height: number = 0;
  _dirty: boolean = false;
  _reactor: Reactor;

  constructor(r: Reactor, height: number) {
    this._reactor = r;
    this._id = nextId++;
    this._subscribers = {};
    this._height = Math.max(height, r._alloc_height);
  }

  abstract get(): T;
  abstract _recompute(): void;
  abstract _activate(): void;
  abstract _deactivate(): void;

  then<A>(f: (v: T) => Incr<A>): Incr<A> {
    return flatten(this.map(f));
  }

  map<A>(f: (v: T) => A): Incr<A> {
    return map(this, f);
  }

  _subscribe(sub: Incr<any>) {
    this._subscribers[sub._id] = sub;
    this._rc++
    if(this._rc === 1) {
      this._activate();
    }
    if(this._active()) {
      sub._set_min_height(this._height + 1);
    }
  }

  _unsubscribe(sub: Incr<any>) {
    delete this._subscribers[sub._id];
    this._rc--
    if(this._rc === 0) {
      this._deactivate();
    }
  }

  _active() {
    return this._rc > 0;
  }

  _notify() {
    for(const i in this._subscribers) {
      this._subscribers[i]._set_dirty()
    }
  }

  _set_min_height(height: number) {
    if(height > this._height) {
      this._height = height;
      for(const i in this._subscribers) {
        this._subscribers[i]._set_min_height(height + 1);
      }
    }
  }

  _set_dirty() {
    if(!this._dirty) {
      this._dirty = true;
      this._scheduled_height = this._height;
      this._reactor._add_dirty(this);
    }
  }

  observe(): Obs<T> {
    return new Obs(this._reactor, this);
  }
}

export function flatten<A>(x: Incr<Incr<A>>): Incr<A> {
  return new Flatten(x._reactor, x);
}

export function map<A, B>(a: Incr<A>, fn: (a: A) => B): Incr<B> {
  return map2(a, a._reactor._constNull, (a, _) => fn(a));
}

export function map2<A, B, C>(a: Incr<A>, b: Incr<B>, fn: (x: A, y: B) => C): Incr<C> {
  return new Map2(a._reactor, a, b, fn);
}

export function map3<A, B, C, D>(a: Incr<A>, b: Incr<B>, c: Incr<C>, fn: (a: A, b: B, c: C) => D): Incr<D> {
  const ab = map2(a, b, (a, b) => {return {a, b}});
  return map2(ab, c, ({a, b}, c) => fn(a, b, c));
}

export function map4<A, B, C, D, E>(
  a: Incr<A>,
  b: Incr<B>,
  c: Incr<C>,
  d: Incr<D>,
  fn: (a: A, b: B, c: C, d: D) => E): Incr<E> {
    const abc = map3(a, b, c, (a, b, c) => {return {a,b,c}});
    return map2(abc, d, ({a,b,c}, d) => fn(a,b,c,d));
}

export function map5<A, B, C, D, E, F>(
  a: Incr<A>,
  b: Incr<B>,
  c: Incr<C>,
  d: Incr<D>,
  e: Incr<E>,
  fn: (a: A, b: B, c: C, d: D, e: E) => F): Incr<F> {
    const abcd = map4(a, b, c, d, (a,b,c,d) => {return {a,b,c,d}});
    return map2(abcd, e, ({a,b,c,d}, e) => fn(a, b, c, d, e));
}

class Obs<T> extends Incr<T> {
  _incr: Incr<T>;
  _watchers: ((v: T) => boolean)[];

  constructor(r: Reactor, incr: Incr<T>) {
    super(r, incr._height + 1);
    this._incr = incr;
    this._incr._subscribe(this);
    this._watchers = [];
  }

  unobserve(): void {
    this._incr._unsubscribe(this);
  }

  get(): T {
    return this._incr.get();
  }

  watch(f: (v: T) => boolean): void {
    this._watchers.push(f)
  }

  _recompute(): void {
    const v = this.get();
    let new_watchers = [];
    for(let i = 0; i < this._watchers.length; i++) {
      const f = this._watchers[i];
      try {
        if(f(v)) {
          new_watchers.push(f);
        }
      } catch(e) {
        console.error(e)
      }
    }
    this._watchers = new_watchers;
    this._notify();
  }

  _activate() {}
  _deactivate() {}
}

class Const<T> extends Incr<T> {
  _value: T;

  constructor(r: Reactor, value: T) {
    super(r, 0)
    this._value = value;
  }

  get(): T {
    return this._value;
  }

  _recompute() {
    this._notify();
  }

  _activate() {
    this._set_dirty();
  }

  _deactivate() {}
}

export class Var<T> extends Incr<T> {
  _value: T;
  _modified: boolean = true;

  constructor(r: Reactor, value: T) {
    super(r, 0);
    this._value = value;
  }

  get(): T {
    return this._value;
  }

  modify(f: (v: T) => T): void {
    this.set(f(this.get()));
  }

  set(value: T) {
    if(this._value === value) {
      return;
    }
    this._value = value;
    this._modified = true;
    if(this._active()) {
      this._set_dirty();
    }
  }

  _recompute() {
    this._modified = false;
    this._notify();
  }

  _activate() {
    if(this._modified) {
      this._set_dirty();
    }
  }

  _deactivate() {}
}

export class Reactor {
  _alloc_height: number = 0;
  _dirty: Heap<Incr<any>>;
  _constNull: Incr<null>

  constructor() {
    this._dirty = new Heap((x, y) => {
      return x._scheduled_height < y._scheduled_height
    });
    this._constNull = this.const(null);
  }

  const<T>(value: T): Incr<T> {
    return new Const(this, value);
  }

  _add_dirty(incr: Incr<any>) {
    this._dirty.push(incr);
  }

  stabilize() {
    while(!this._dirty.empty()) {
      let incr = this._dirty.pop();
      incr._dirty = false;
      if(incr._scheduled_height < incr._height) {
        // this one has been de-prioritized since being scheduled;
        // throw it back in the heap for later.
        incr._set_dirty();
        continue;
      }
      this._alloc_height = incr._height + 1;
      incr._recompute();
    }
    this._alloc_height = 0;
  }

  Var<T>(value: T): Var<T> {
    return new Var(this, value);
  }

  event<A extends any[], B>(f: (...args: A) => B): (...args: A) => B {
    return (...args) => {
      try {
        return f(...args)
      } finally {
        this.stabilize();
      }
    }
  }
}

class Map2<A, B, C> extends Incr<C> {
  private _a: Incr<A>;
  private _b: Incr<B>;
  private _f: (a: A, b: B) => C;
  private _value: Optional<C> = null;

  constructor(r: Reactor, a: Incr<A>, b: Incr<B>, f: (a: A, b: B) => C) {
    super(r, Math.max(a._height, b._height) + 1);
    this._a = a;
    this._b = b;
    this._f = f;
  }

  get(): C {
    return notNull(this._value);
  }

  _activate(): void {
    this._a._subscribe(this);
    this._b._subscribe(this);
  }

  _deactivate(): void {
    this._a._unsubscribe(this);
    this._b._unsubscribe(this);
  }

  _recompute(): void {
    const last = this._value;
    const next = this._f(this._a.get(), this._b.get());
    if(last === null || last.some !== next) {
      this._value = { some: next };
      this._notify();
    }
  }
}

class Flatten<A> extends Incr<A> {
  private _input: Incr<Incr<A>>;
  private _input_value: Optional<Incr<A>> = null;
  private _value: Optional<A> = null;

  constructor(r: Reactor, input: Incr<Incr<A>>) {
    super(r, input._height + 1);
    this._input = input;
  }

  get(): A {
    return notNull(this._value);
  }

  _activate(): void {
    this._input._subscribe(this);
    if(this._input_value !== null) {
      this._input_value.some._subscribe(this);
    }
  }

  _deactivate(): void {
    this._input._unsubscribe(this);
    if(this._input_value !== null) {
      this._input_value.some._unsubscribe(this);
    }
  }

  _recompute(): void {
    const last = this._input_value;
    const next = this._input.get();
    if(last !== null && last.some === next) {
      const value = next.get();
      if(this._value === null || this._value.some !== value) {
        this._value = { some: value }
        this._notify();
      }
      return;
    }

    const wasActive = next._active();

    if(last !== null) {
      last.some._unsubscribe(this);
    }
    next._subscribe(this);
    this._input_value = { some: next };

    // Run us again. On our next run, we should hit the scenario above where
    // next is itself unchanged (but its value may be updated).
    this._set_dirty();

    if(!wasActive) {
      // Next wasn't previously active, so it needs to be scheduled.
      // If it *was* previously active, then either:
      //
      // 1. It has already run and is up to date, or
      // 2. It is still in the queue, and will be run eventually.
      next._set_dirty();
    }
  }
}
