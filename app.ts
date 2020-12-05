
import { diff, patch, h, text, makeNode, VNode } from './mvd.js';

function app() {
  let ctr = 0;
  return (redraw: () => void) => {
    return h('div', {}, [
      h('button', { onclick: () => { ctr += 1; redraw(); } }, [text("+")]),
      text(ctr.toString()),
      h('button', { onclick: () => { ctr -= 1; redraw(); } }, [text("-")]),
    ]);
  }
}

function runApp(elt: Element) {
  const render = app();
  let vdom: VNode;
  let dom: ChildNode;
  const redraw = () => {
    const newVdom = render(redraw);
    const p = diff(vdom, newVdom);
    dom = patch(dom, p);
    vdom = newVdom;
  };
  vdom = render(redraw);
  dom = makeNode(vdom);
  elt.replaceWith(dom)
}

document.addEventListener('DOMContentLoaded', () => {
  const elt = document.getElementById("app");
  if(!elt) {
    throw new Error("did not find app element");
  }
  runApp(elt);
});
