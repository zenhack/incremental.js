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
    this._height = height;
  }

  abstract get(): T;
  abstract _recompute(): void;
  abstract _activate(): void;
  abstract _deactivate(): void;

  then<A>(f: (v: T) => Incr<A>): Incr<A> {
    return flatten(this.map(f));
  }

  map<A>(f: (v: T) => A): Incr<A> {
    return new Map(this._reactor, this, f);
  }

  apply<A>(f: Incr<(v: T) => A>): Incr<A> {
    return f.then<A>(f => this.map(f))
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

export function apply<A, B>(f: Incr<(v: A) => B>, x: Incr<A>): Incr<B> {
  return x.apply(f)
}

export function flatten<A>(x: Incr<Incr<A>>): Incr<A> {
  return new Flatten(x._reactor, x);
}

export function map<A, B>(a: Incr<A>, fn: (a: A) => B): Incr<B> {
  return a.map(fn);
}

export function map2<A, B, C>(a: Incr<A>, b: Incr<B>, fn: (x: A, y: B) => C): Incr<C> {
  return apply(a.map((a: A) => (b: B) => fn(a, b)), b);
}

export function map3<A, B, C, D>(a: Incr<A>, b: Incr<B>, c: Incr<C>, fn: (a: A, b: B, c: C) => D): Incr<D> {
  return apply<C, D>(map2<A, B, (v: C) => D>(a, b, (a, b) => c => fn(a, b, c)), c);
}

export function map4<A, B, C, D, E>(
  a: Incr<A>,
  b: Incr<B>,
  c: Incr<C>,
  d: Incr<D>,
  fn: (a: A, b: B, c: C, d: D) => E): Incr<E> {
    return apply<D, E>(map3<A, B, C, (v: D) => E>(a, b, c, (a, b, c) => d => fn(a, b, c, d)), d)
}

export function map5<A, B, C, D, E, F>(
  a: Incr<A>,
  b: Incr<B>,
  c: Incr<C>,
  d: Incr<D>,
  e: Incr<E>,
  fn: (a: A, b: B, c: C, d: D, e: E) => F): Incr<F> {
    return apply<E, F>(map4<A, B, C, D, (v: E) => F>(a, b, c, d, (a, b, c, d) => e => fn(a, b, c, d, e)), e);
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
  _dirty: Heap<Incr<any>>;

  constructor() {
    this._dirty = new Heap((x, y) => {
      return x._scheduled_height < y._scheduled_height
    });
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
      incr._recompute();
    }
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

class Map<A, B> extends Incr<B> {
  private _input: Incr<A>;
  private _f: (v: A) => B;
  private _value: Optional<B> = null;

  constructor(r: Reactor, input: Incr<A>, f: (v: A) => B) {
    super(r, input._height + 1);
    this._input = input;
    this._f = f;
  }

  get(): B {
    return notNull(this._value);
  }

  _activate(): void {
    this._input._subscribe(this);
  }

  _deactivate(): void {
    this._input._unsubscribe(this);
  }

  _recompute(): void {
    const last = this._value;
    const next = this._f(this._input.get());
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
