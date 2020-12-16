
import { diff, patch, makeNode, VNode, EventHandler } from './mvd.js';
import { Incr, Reactor } from './inc.js';

export type App = (r: Reactor) => Incr<VNode>;

export function runApp(elt: Element, app: App): void {
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
