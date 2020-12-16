import { Heap } from './heap.js';
import { Optional } from './optional.js';

let nextId = 0;

export abstract class Incr<T> {
  private _id: number;
  private _subscribers: {[k: number]: Incr<any>};
  private _rc: number;
  _height: number;
  _dirty: boolean;
  _reactor: Reactor;

  constructor(r: Reactor) {
    this._reactor = r;
    this._id = nextId++;
    this._subscribers = {};
    this._rc = 0;
    this._height = 0;
    this._dirty = false;
  }

  abstract get(): T;
  abstract _recompute(): void;
  abstract _activate(): void;
  abstract _deactivate(): void;

  then<A>(f: (v: T) => Incr<A>): Incr<A> {
    return new Then<T, A>(this._reactor, this, f);
  }

  map<A>(f: (v: T) => A): Incr<A> {
    return this.then(x => this._reactor.const(f(x)));
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

  _set_dirty() {
    if(!this._dirty) {
      this._dirty = true;
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
    super(r);
    this._incr = incr;
    this._incr._subscribe(this);
    this._watchers = [];
    this._height = this._incr._height + 1;
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
    this._height = this._incr._height + 1;
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
    super(r)
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
  _modified: boolean;

  constructor(r: Reactor, value: T) {
    super(r);
    this._value = value;
    this._modified = true;
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
      return x._height < y._height
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
      incr._recompute();
      incr._dirty = false;
    }
  }

  newVar<T>(value: T): Var<T> {
    return new Var(this, value);
  }
}

class Then<A, B> extends Incr<B> {
  _input: Incr<A>;
  _input_value: Optional<A>;
  _f: (v: A) => Incr<B>;
  _last: Optional<Incr<B>>;
  _value: Optional<B>;
  _height: number;

  constructor(r: Reactor, input: Incr<A>, f: (v: A) => Incr<B>) {
    super(r);
    this._input = input;
    this._input_value = null;
    this._f = f;
    this._last = null;
    this._value = null;
    this._height = input._height + 1;
  }

  get(): B {
    if(this._value === null) {
      throw new Error("Value is not ready; comptue it first.");
    }
    return this._value.some;
  }

  _activate(): void {
    this._input._subscribe(this);
    if(this._last !== null) {
      this._last.some._subscribe(this);
    }
  }

  _deactivate(): void {
    this._input._unsubscribe(this);
    if(this._last !== null) {
      this._last.some._unsubscribe(this);
    }
  }

  _recompute(): void {
    let next = this._last;
    let was_active = true;
    let input_value = this._input.get();
    if(next === null
        || this._input_value === null
        || input_value !== this._input_value.some) {
      this._input_value = { some: input_value };
      next = { some: this._f(input_value) };
      was_active = next.some._active();
      if(next !== this._last) {
        if(this._last !== null) {
          this._last.some._unsubscribe(this);
        }
        next.some._subscribe(this);
      }
      this._last = next;
    }
    if(next === null) {
      throw new Error("impossible");
    }
    this._height = Math.max(
      this._height,
      Math.max(this._input._height, next.some._height) + 1,
    );
    if(was_active) {
      this._value = { some: next.some.get() };
      this._notify()
    } else {
      // This node wasn't previously part of the dependency graph.
      // Schedule it to be run. When it completes, it will schedule
      // us again.
      next.some._set_dirty();
    }
  }
}
