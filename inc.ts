import { Heap } from './heap.js';

let nextId = 0;

class Incr<T> {
  _id: number;
  _subscribers: {[k: number]: Incr<any>};
  _rc: number;
  _height: number;
  _dirty: boolean;

  constructor() {
    this._id = nextId++;
    this._subscribers = {};
    this._rc = 0;
    this._height = 0;
    this._dirty = false;
  }

  value(): T {
    throw new Error("Not Implemented");
  }

  then<A>(f: (v: T) => Incr<A>): Incr<A> {
    return new Then<A>(this, f);
  }

  map<A>(f: (v: T) => A): Incr<A> {
    return this.then(x => new Const(f(x)));
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

  _recompute(_reactor: Reactor): void {}
  _activate(): void {}
  _deactivate(): void {}
}

class Obs<T> extends Incr<T> {
  _incr: Incr<T>;
  _watchers: ((v: T) => boolean)[];

  constructor(incr: Incr<T>) {
    super();
    this._incr = incr;
    this._incr._subscribe(this);
    this._watchers = [];
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

  _recompute(): void {
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
  }
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
}

class Var<T> extends Incr<T> {
  _reactor: Reactor;
  _value: T;

  constructor(reactor: Reactor, value: T) {
    super();
    this._reactor = reactor;
    this._value = value;
  }

  value(): T {
    return this._value;
  }

  set(value: T) {
    if(this._value === value) {
      return;
    }
    this._value = value;
    this._set_dirty(this._reactor);
  }
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
    let incr = this._dirty.pop();
    while(incr !== undefined) {
      incr._recompute(this);
      incr._notify(this);
      incr._dirty = false;
      incr = this._dirty.pop();
    }
  }

  newVar<T>(value: T): Var<T> {
    return new Var(this, value);
  }
}

class Then<T> extends Incr<T> {
  _prev: Incr<any>;
  _f: (v: any) => Incr<T>;
  _last: null | Incr<T>;
  _value: undefined | T;
  _height: number;

  constructor(prev: Incr<any>, f: (v: any) => Incr<T>) {
    super();
    this._prev = prev;
    this._f = f;
    this._last = null;
    this._value = undefined;
    this._height = prev._height + 1;
  }

  value() {
    if(this._value === undefined) {
      throw new Error("Value is undefined; comptue it first.");
    }
    return this._value;
  }

  _activate() {
    this._prev._subscribe(this);
    if(this._last !== null) {
      this._last._subscribe(this);
    }
  }

  _deactivate() {
    this._prev._unsubscribe(this);
    if(this._last !== null) {
      this._last._unsubscribe(this);
    }
  }

  _recompute(reactor: Reactor): void {
    const next = this._f(this._prev.value());
    if(next === this._last) {
      return
    }
    if(this._last !== null && this._active()) {
      this._last._unsubscribe(this);
      next._subscribe(this);
    }
    this._last = next;
    this._height = Math.max(
      this._height,
      Math.max(this._prev._height, next._height) + 1,
    );
  }
}