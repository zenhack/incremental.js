import { Heap } from './heap.js';
import { Optional } from './optional.js';

let nextId = 0;

abstract class Incr<T> {
  private _id: number;
  private _subscribers: {[k: number]: Incr<any>};
  private _rc: number;
  _height: number;
  _dirty: boolean;

  constructor() {
    this._id = nextId++;
    this._subscribers = {};
    this._rc = 0;
    this._height = 0;
    this._dirty = false;
  }

  abstract value(): T;
  abstract _recompute(_reactor: Reactor): void;
  abstract _activate(): void;
  abstract _deactivate(): void;

  then<A>(f: (v: T) => Incr<A>): Incr<A> {
    return new Then<T, A>(this, f);
  }

  map<A>(f: (v: T) => A): Incr<A> {
    return this.then(x => just(f(x)));
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

  _notify(reactor: Reactor) {
    for(const i in this._subscribers) {
      this._subscribers[i]._set_dirty(reactor)
    }
  }

  _set_dirty(reactor: Reactor) {
    if(!this._dirty) {
      this._dirty = true;
      reactor._add_dirty(this);
    }
  }

  observe(): Obs<T> {
    return new Obs(this);
  }
}

class Obs<T> extends Incr<T> {
  _incr: Incr<T>;
  _watchers: ((v: T) => boolean)[];

  constructor(incr: Incr<T>) {
    super();
    this._incr = incr;
    this._incr._subscribe(this);
    this._watchers = [];
    this._height = this._incr._height + 1;
  }

  unobserve(): void {
    this._incr._unsubscribe(this);
  }

  value(): T {
    return this._incr.value();
  }

  watch(f: (v: T) => boolean): void {
    this._watchers.push(f)
  }

  _recompute(reactor: Reactor): void {
    this._height = this._incr._height + 1;
    const v = this.value();
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
    this._notify(reactor);
  }

  _activate() {}
  _deactivate() {}
}

// Convert a plain value into an Incr which never changes.
export function just<T>(x: T): Incr<T> {
  return new Const(x);
}

class Const<T> extends Incr<T> {
  _value: T;

  constructor(value: T) {
    super()
    this._value = value;
  }

  value(): T {
    return this._value;
  }

  _recompute(reactor: Reactor) {
    this._notify(reactor);
  }

  _activate() {}
  _deactivate() {}
}

class Var<T> extends Incr<T> {
  _reactor: Reactor;
  _value: T;
  _modified: boolean;

  constructor(reactor: Reactor, value: T) {
    super();
    this._reactor = reactor;
    this._value = value;
    this._modified = true;
  }

  value(): T {
    return this._value;
  }

  set(value: T) {
    if(this._value === value) {
      return;
    }
    this._value = value;
    this._modified = true;
    if(this._active()) {
      this._set_dirty(this._reactor);
    }
  }

  _recompute(reactor: Reactor) {
    this._modified = false;
    this._notify(reactor);
  }

  _activate() {
    if(this._modified) {
      this._set_dirty(this._reactor);
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

  _add_dirty(incr: Incr<any>) {
    this._dirty.push(incr);
  }

  stabilize() {
    while(!this._dirty.empty()) {
      let incr = this._dirty.pop();
      incr._recompute(this);
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

  constructor(input: Incr<A>, f: (v: A) => Incr<B>) {
    super();
    this._input = input;
    this._input_value = null;
    this._f = f;
    this._last = null;
    this._value = null;
    this._height = input._height + 1;
  }

  value(): B {
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

  _recompute(reactor: Reactor): void {
    let next = this._last;
    let was_active = true;
    let input_value = this._input.value();
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
      this._value = { some: next.some.value() };
      this._notify(reactor)
    } else {
      // This node wasn't previously part of the dependency graph.
      // Schedule it to be run. When it completes, it will schedule
      // us again.
      next.some._set_dirty(reactor);
    }
  }
}
