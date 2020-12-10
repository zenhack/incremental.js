
import { diff, patch, h, text, makeNode, VNode, EventHandler } from './mvd.js';
import { Reactor, Incr } from './inc.js';

function update(r: Reactor, handler: EventHandler): EventHandler {
  return () => {
    handler();
    r.stabilize();
  }
}

type App = (r: Reactor) => Incr<VNode>;

function runApp(elt: Element, app: App): void {
  const r = new Reactor();
  const view = app(r);
  let dom: ChildNode | null = null;
  let vdom: VNode | null = null;
  let renderWaiting = false;
  view.observe().watch(_ => {
    if(renderWaiting) {
      return true;
    }
    renderWaiting = true;
    window.requestAnimationFrame(() => {
      renderWaiting = false;
      const newVDom = view.get();
      if(vdom === null || dom === null) {
        vdom = newVDom
        dom = makeNode(vdom);
      } else {
        const p = diff(vdom, newVDom);
        vdom = newVDom;
        dom = patch(dom, p);
      }
      elt.replaceWith(dom);
    })
    return true;
  });
  r.stabilize();
}

function app(r: Reactor): Incr<VNode> {
  const ctr = r.newVar(0);

  const btn = (name: string, onclick: EventHandler): VNode => {
    return h('button', { onclick: update(r, onclick) }, [text(name)]);
  }

  const addBtn = btn("+", () => ctr.modify(x => x + 1))
  const subBtn = btn("-", () => ctr.modify(x => x - 1))

  return ctr.map(value => {
    return(h('div', {}, [addBtn, text(value.toString()), subBtn]));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const elt = document.getElementById("app");
  if(!elt) {
    throw new Error("did not find app element");
  }
  runApp(elt, app);
});
