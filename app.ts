
import { diff, patch, h, text, makeNode, VNode, EventHandler } from './mvd.js';
import * as inc from './inc.js';

export class Reactor extends inc.Reactor {
  event(handler: EventHandler): EventHandler {
    return (e) => {
      try {
        handler(e);
      } finally {
        this.stabilize();
      }
    }
  }
}

export type App = (r: Reactor) => inc.Incr<VNode>;

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
