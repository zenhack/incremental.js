import { App, runApp } from './app.js';
import { h, text, VNode, EventHandler } from './mvd.js';
import { Reactor, Incr } from './inc.js';

function app(r: Reactor): Incr<VNode> {
  const ctr = r.Var(0);

  const btn = (name: string, onclick: EventHandler): VNode => {
    return h('button', { onclick: r.event(onclick) }, [text(name)]);
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
