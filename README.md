This repository hosts two independent, but complimentary
typescript/javascript libraries:

- A VDom implementation
- A generic library for working with incremental/reactive computation.

...as well as a bit of glue code to tie them together.

These libraries are *tiny*; their sum total is less than 800 lines of
typescript, and they have *zero* runtime dependencies.

# MVD: Minimal VDom

The first library is a stand-alone implementation of a Virtual DOM;
you can generate HTML with it like:

```javascript

import { h, text, VNode, makeNode } from 'mvd';

function render() {
    return h('a', { href: "https://example.com" }, [text("Hello, World!")]);
}

document.addEventListener('DOMContentLoaded', () => {
    const elt = document.getElementById('app');
    elt.appendChild(makeNode(render()));
});

```

The library provides `diff` and `patch` functions which can be used to
do the diffing and patching that defines the virtual dom pattern.

# Incremental.JS

The other library handles reactive/incremental computations. It is
inspired by Jane Street's [incremental][incremental] OCaml library.
It allows you to perform computations _incrementally_, i.e., when some
of the inputs change, only the affected values need to be re-computed.

For example:

```javascript
import { Reactor } from 'inc';

// compute a simple expression, the normal way. The arguments and
// return value are plain old numbers.
function computeNormally(x, y, z) {
    return (x * y) + z
}

// compute the same thing, but incrementally. This time, the arguments
// are not plain numbers but _incremental_ numbers -- of type
// Incr<number> in typescript. The result is also an Incr<number>.
function computeIncrementally(xv, yv, zv) {
    // `a.map(f)` is like `f(a)`, but incremental (will only be re-computed
    // if `a` changes. `a.map2(b, f)` is like `f(a, b)`, but incremental
    // (will only be recomputed if `a` or `b` changes).
    //
    // So this is a bit noisy, but it's doing the same computation
    // as the above, just incremental.
    return xv.map2(yv, (x, y) => x * y).map(xy => zv.map(z => xy + z)
}

// Now the fun stuff! we create a Reactor, which manages the whole
// computation, and some variables, with initial values.

const r = new Reactor();
xv = r.newVar(1);
yv = r.newVar(2);
zv = r.newVar(3);

// Generate the incrementalized result. The computation has not actually
// been done at this point, we've only set it up.
incResult = computeIncrementally(xv, yv, zv);

// Now, we define a callback which will be executed each time the result
// is changed.
incResult.observe().watch(result => {
    console.log("result changed: ", result);
});

// Stabilize causes the computation to be updated. Since we haven't
// run it before, everything has to be computed from scratch. It uses
// the current values of the variables we defined, so this prints
// (1 * 2) + 3 = 5
r.stabilize()

// Change the input x to 4:
xv.set(4)

// Update the computation. This will print
// (4 * 2) + 3 = 11.

// Change the input z to 1.
zv.set(1)

// ...and update it again. This gives us `(4 * 2) + 1 = 9`.
// But! since neither x or y changed, `x * y = 4 * 2 = 8` will not
// be recomputed this time. Instead, the existing value `8` will be
// used, and only 8 + z = 8 + 1 = 9 must be computed.
r.stabilize()
```

TODO: more examples & complete documentation, talk about `.then()`, the
`app` module for integration, etc.

[incremental]: https://opensource.janestreet.com/incremental/
