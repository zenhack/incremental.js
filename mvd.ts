
import { impossible } from './util.js';

// A Text node in the VDom
export type VText = { text: string }

export type EventHandler = (e: Event) => void

// An attribute list.
export type VAttrs = {[k: string]: string}
export type VEvents = {[k: string]: EventHandler}
export type VProperties = {[k: string]: string | EventHandler}

// An element in the VDom.
export type VElt = {
  tag: string,
  attrs: VAttrs,
  events: VEvents,
  kids: VNode[],
}

export type VNode = VElt | VText

// A patch to apply to a node.
export type NodePatch =
  | { keep: null }
  // Keep the node unchanged
  | { replace: VNode }
  // Replace the node wholesale with a different one.
  | { parts: { attrs: AttrPatch[], events: EventPatch[], kids: KidsPatch } }
  // Apply patches to parts of the node.

// A patch to apply to the children of a node.
export type KidsPatch = {
  common: NodePatch[],
  // Patches to apply to the common prefix of the two nodes.
  drop: number,
  // How many nodes to drop from the old node's children
  append: VNode[],
  // Nodes to append to the new child list.
}

// A patch to apply to an attribute list.
export type AttrPatch =
  | { remove: string }
  // Remove the given attribute
  | { upsert: {key: string, value: string} }
  // update the given attribute, or add it if it does not exist.

export type EventPatch =
  | { removeEvent: string, handler: EventHandler }
  | { addEvent: string, handler: EventHandler }

// computing patches

function diffNode(prev: VNode, next: VNode): NodePatch {
  if(prev === next) {
    return { keep: null }
  }
  if('tag' in prev && 'tag' in next) {
    return diffElt(prev, next);
  } else if('text' in prev && 'text' in next) {
    return diffText(prev, next);
  } else {
    return { replace: next }
  }
}

function diffElt(prev: VElt, next: VElt): NodePatch {
  if(prev.tag !== next.tag) {
    return { replace: next }
  }
  return {
    parts: {
      attrs: diffAttrs(prev.attrs, next.attrs),
      events: diffEvents(prev.events, next.events),
      kids: diffKids(prev.kids, next.kids),
    }
  }
}

function eventName(key: string): string {
  if(key.startsWith('on')) {
    return key.slice(2);
  } else {
    return key;
  }
}

function diffEvents(prev: VEvents, next: VEvents): EventPatch[] {
  const ret: EventPatch[] = [];
  for(const k in prev) {
    if(!(k in next)) {
      ret.push({ removeEvent: k, handler: prev[k] });
    }
  }
  for(const k in next) {
    if(prev[k] === next[k]) {
      continue
    }
    if(k in prev) {
      ret.push({ removeEvent: k, handler: prev[k] })
    }
    ret.push({addEvent: k, handler: next[k]})
  }
  return ret;
}

function diffAttrs(prev: VAttrs, next: VAttrs): AttrPatch[] {
  const ret = [];
  for(const k in prev) {
    if(!(k in next)) {
      ret.push({remove: k})
    }
  }
  for(const k in next) {
    if(!(k in prev) || (prev[k] !== next[k])) {
      ret.push({upsert: { key: k, value: next[k] }})
    }
  }
  return ret;
}

function diffKids(prev: VNode[], next: VNode[]): KidsPatch {
  const minLen = Math.min(prev.length, next.length);
  const common = [];
  for(let i = 0; i < minLen; i++) {
    common.push(diffNode(prev[i], next[i]));
  }
  const append = [];
  for(let i = minLen; i < next.length; i++) {
    append.push(next[i]);
  }
  return {
    common,
    append,
    drop: Math.max(0, prev.length - minLen),
  }
}

function diffText(prev: VText, next: VText): NodePatch {
  if(prev.text === next.text) {
    return { keep: null }
  } else {
    return { replace: next }
  }
}

// Convert a VNode into a dom node.

export function makeNode(vnode: VNode): ChildNode {
  if('tag' in vnode) {
    return E(vnode.tag, vnode.attrs, vnode.events, vnode.kids.map(k => makeNode(k)));
  } else {
    return T(vnode.text);
  }
}

// Applying patches to dom nodes

function patchNode(node: ChildNode, patch: NodePatch): ChildNode {
  if('keep' in patch) {
    return node;
  } else if('replace' in patch) {
    const newNode = makeNode(patch.replace);
    node.replaceWith(newNode);
    return newNode;
  } else if('parts' in patch) {
    if(!(node instanceof Element)) {
      throw new Error("This patch does not apply to non-element nodes.");
    }
    for(const i in patch.parts.attrs) {
      patchAttr(node, patch.parts.attrs[i])
    }
    for(const i in patch.parts.events) {
      patchEvent(node, patch.parts.events[i]);
    }
    patchKids(node, patch.parts.kids);
    return node;
  } else {
    impossible(patch)
  }
}

function patchKids(elt: Element, patch: KidsPatch) {
  for(let i = 0; i < patch.common.length; i++) {
    patchNode(elt.childNodes[i], patch.common[i]);
  }
  const toDrop = [];
  for(let i = patch.common.length; i < elt.childNodes.length; i++) {
    toDrop.push(elt.childNodes[i]);
  }
  for(const i in toDrop) {
    toDrop[i].remove();
  }
  for(const i in patch.append) {
    elt.appendChild(makeNode(patch.append[i]));
  }
}

function patchAttr(elt: Element, patch: AttrPatch) {
  if('remove' in patch) {
    elt.removeAttribute(patch.remove);
  } else if('upsert' in patch) {
    elt.setAttribute(patch.upsert.key, patch.upsert.value);
  } else {
    impossible(patch);
  }
}

function patchEvent(elt: Element, patch: EventPatch) {
  if('removeEvent' in patch) {
    elt.removeEventListener(patch.removeEvent, patch.handler);
  } else if('addEvent' in patch) {
    elt.addEventListener(patch.addEvent, patch.handler);
  } else {
    impossible(patch);
  }
}

// Helpers for generating Dom nodes.

function E(tag: string, attrs: VAttrs, events: VEvents, kids: ChildNode[]): Element {
  const elt = document.createElement(tag);
  for(const k in attrs) {
    elt.setAttribute(k, attrs[k]);
  }
  for(const k in events) {
    elt.addEventListener(k, events[k]);
  }
  for(const node in kids) {
    elt.appendChild(kids[node]);
  }
  return elt;
}

function T(str: string): ChildNode {
  return document.createTextNode(str);
}

// Helpers for generating VNodes

export function h(tag: string, attrs: {[k: string]: string | EventHandler}, kids: VNode[]): VNode {
  const stringAttrs: VAttrs = {}
  const events: VEvents = {}
  for(const k in attrs) {
    const v = attrs[k];
    if(typeof(v) == 'string') {
      stringAttrs[k] = v;
    } else {
      events[eventName(k)] = v;
    }
  }
  return {tag, attrs: stringAttrs, events, kids}
}

export function text(s: string): VText {
  return { text: s }
}

export function diff(prev: VNode, next: VNode): NodePatch {
  return diffNode(prev, next);
}

export function patch(node: ChildNode, patch_: NodePatch): ChildNode {
  return patchNode(node, patch_);
}
