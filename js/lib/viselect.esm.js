/*! @viselect/vanilla v3.10.1 MIT | https://github.com/simonwep/viselect/tree/master/packages/vanilla */
var P = class {
  _listeners = /* @__PURE__ */ new Map();
  addEventListener(e, t) {
    const s = this._listeners.get(e) ?? /* @__PURE__ */ new Set();
    return this._listeners.set(e, s), s.add(t), this;
  }
  removeEventListener(e, t) {
    return this._listeners.get(e)?.delete(t), this;
  }
  dispatchEvent(e, ...t) {
    let s = !0;
    for (const i of this._listeners.get(e) ?? []) s = i(...t) !== !1 && s;
    return s;
  }
  unbindAllListeners() {
    this._listeners.clear();
  }
  on = this.addEventListener;
  off = this.removeEventListener;
  emit = this.dispatchEvent;
}, T = (e, t = "px") => typeof e == "number" ? e + t : e, v = ({ style: e }, t, s) => {
  if (typeof t == "object")
    for (const [i, o] of Object.entries(t)) o !== void 0 && (e[i] = T(o));
  else s !== void 0 && (e[t] = T(s));
}, w = (e = 0, t = 0, s = 0, i = 0) => {
  const o = {
    x: e,
    y: t,
    width: s,
    height: i,
    top: t,
    left: e,
    right: e + s,
    bottom: t + i
  };
  return {
    ...o,
    toJSON: () => JSON.stringify(o)
  };
}, j = (e) => {
  let t, s = -1, i = !1;
  return {
    next: (...o) => {
      t = o, i || (i = !0, s = requestAnimationFrame(() => {
        e(...t), i = !1;
      }));
    },
    cancel: () => {
      cancelAnimationFrame(s), i = !1;
    }
  };
}, L = (e, t, s = "touch") => {
  switch (s) {
    case "center": {
      const i = t.left + t.width / 2, o = t.top + t.height / 2;
      return i >= e.left && i <= e.right && o >= e.top && o <= e.bottom;
    }
    case "cover":
      return t.left >= e.left && t.top >= e.top && t.right <= e.right && t.bottom <= e.bottom;
    case "touch":
      return e.right >= t.left && e.left <= t.right && e.bottom >= t.top && e.top <= t.bottom;
  }
}, X = () => matchMedia("(hover: none), (pointer: coarse)").matches, Y = () => "safari" in window, x = (e) => Array.isArray(e) ? e : [e], R = (e) => (t, s, i, o = {}) => {
  (t instanceof HTMLCollection || t instanceof NodeList) && (t = Array.from(t)), s = x(s), t = x(t);
  for (const n of t) if (n) for (const l of s) n[e](l, i, {
    capture: !1,
    ...o
  });
}, y = R("addEventListener"), m = R("removeEventListener"), E = (e) => {
  const { clientX: t, clientY: s, target: i } = e.touches?.[0] ?? e;
  return {
    x: t,
    y: s,
    target: i
  };
}, b = (e, t = document) => x(e).map((s) => typeof s == "string" ? Array.from(t.querySelectorAll(s)) : s instanceof Element ? s : null).flat().filter(Boolean), K = (e, t) => t.some((s) => typeof s == "number" ? e.button === s : typeof s == "object" ? s.button !== e.button ? !1 : s.modifiers.every((i) => {
  switch (i) {
    case "alt":
      return e.altKey;
    case "ctrl":
      return e.ctrlKey || e.metaKey;
    case "shift":
      return e.shiftKey;
  }
}) : !1), { abs: S, max: M, min: k, ceil: C } = Math, B = (e = []) => ({
  stored: e,
  selected: [],
  touched: [],
  changed: {
    added: [],
    removed: []
  }
}), H = class extends P {
  static version = "3.10.1";
  _options;
  _selection = B();
  _area;
  _clippingElement;
  _targetElement;
  _targetBoundary;
  _targetBoundaryScrolled = !0;
  _targetRect;
  _selectables = [];
  _latestElement;
  _areaLocation = {
    y1: 0,
    x2: 0,
    y2: 0,
    x1: 0
  };
  _areaRect = w();
  _singleClick = !0;
  _frame;
  _scrollAvailable = !0;
  _scrollingActive = !1;
  _scrollSpeed = {
    x: 0,
    y: 0
  };
  _scrollDelta = {
    x: 0,
    y: 0
  };
  _lastMousePosition = {
    x: 0,
    y: 0
  };
  constructor(e) {
    super(), this._options = {
      selectionAreaClass: e.selectionAreaClass ?? "selection-area",
      selectionContainerClass: e.selectionContainerClass ?? void 0,
      selectables: e.selectables ?? [],
      document: e.document ?? window.document,
      startAreas: e.startAreas ?? ["html"],
      boundaries: e.boundaries ?? ["html"],
      container: e.container ?? "body",
      behaviour: {
        overlap: e.behaviour?.overlap ?? "invert",
        intersect: e.behaviour?.intersect ?? "touch",
        triggers: e.behaviour?.triggers ?? [0],
        startThreshold: e.behaviour?.startThreshold ? typeof e.behaviour.startThreshold == "number" ? e.behaviour.startThreshold : {
          x: 10,
          y: 10,
          ...e.behaviour.startThreshold
        } : {
          x: 10,
          y: 10
        },
        scrolling: {
          speedDivider: e.behaviour?.scrolling?.speedDivider ?? 10,
          manualSpeed: e.behaviour?.scrolling?.manualSpeed ?? 750,
          startScrollMargins: {
            x: e.behaviour?.scrolling?.startScrollMargins?.x ?? 0,
            y: e.behaviour?.scrolling?.startScrollMargins?.y ?? 0
          }
        }
      },
      features: {
        range: e.features?.range ?? !0,
        touch: e.features?.touch ?? !0,
        deselectOnBlur: e.features?.deselectOnBlur ?? !1,
        singleTap: {
          allow: e.features?.singleTap?.allow ?? !0,
          intersect: e.features?.singleTap?.intersect ?? "native"
        }
      }
    };
    for (const o of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) typeof this[o] == "function" && (this[o] = this[o].bind(this));
    const { document: t, selectionAreaClass: s, selectionContainerClass: i } = this._options;
    this._area = t.createElement("div"), this._clippingElement = t.createElement("div"), this._clippingElement.appendChild(this._area), this._area.classList.add(s), i && this._clippingElement.classList.add(i), v(this._area, {
      willChange: "top, left, bottom, right, width, height",
      top: 0,
      left: 0,
      position: "fixed"
    }), v(this._clippingElement, {
      overflow: "hidden",
      position: "fixed",
      transform: "translate3d(0, 0, 0)",
      pointerEvents: "none",
      zIndex: "1"
    }), this._frame = j((o) => {
      this._recalculateSelectionAreaRect(), this._updateElementSelection(), this._emitEvent("move", o), this._redrawSelectionArea();
    }), this.enable();
  }
  _toggleStartEvents(e = !0) {
    const { document: t, features: s } = this._options, i = e ? y : m;
    i(t, "mousedown", this._onTapStart), s.touch && i(t, "touchstart", this._onTapStart, { passive: !1 });
  }
  _onTapStart(e, t = !1) {
    const { x: s, y: i, target: o } = E(e), { document: n, startAreas: l, boundaries: a, features: d, behaviour: _ } = this._options, r = o.getBoundingClientRect();
    if (e instanceof MouseEvent && !K(e, _.triggers)) return;
    const f = b(l, n), p = b(a, n);
    this._targetElement = p.find((g) => L(g.getBoundingClientRect(), r));
    const u = e.composedPath(), h = f.find((g) => u.includes(g));
    if (this._targetBoundary = p.find((g) => u.includes(g)), !this._targetElement || !h || !this._targetBoundary || !t && this._emitEvent("beforestart", e) === !1) return;
    this._areaLocation = {
      x1: s,
      y1: i,
      x2: 0,
      y2: 0
    };
    const c = n.scrollingElement ?? n.body;
    this._scrollDelta = {
      x: c.scrollLeft,
      y: c.scrollTop
    }, this._singleClick = !0, this.clearSelection(!1, !0), y(n, ["touchmove", "mousemove"], this._delayedTapMove, { passive: !1 }), y(n, [
      "mouseup",
      "touchcancel",
      "touchend"
    ], this._onTapStop), y(n, "scroll", this._onScroll), d.deselectOnBlur && (this._targetBoundaryScrolled = !1, y(this._targetBoundary, "scroll", this._onStartAreaScroll));
  }
  _onSingleTap(e) {
    const { singleTap: { intersect: t }, range: s } = this._options.features, i = E(e);
    let o;
    if (t === "native") o = i.target;
    else if (t === "touch") {
      this.resolveSelectables();
      const { x: l, y: a } = i;
      o = this._selectables.find((d) => {
        const { right: _, left: r, top: f, bottom: p } = d.getBoundingClientRect();
        return l < _ && l > r && a < p && a > f;
      });
    }
    if (!o) return;
    for (this.resolveSelectables(); !this._selectables.includes(o); ) if (o.parentElement) o = o.parentElement;
    else {
      this._targetBoundaryScrolled || this.clearSelection();
      return;
    }
    const { stored: n } = this._selection;
    if (this._emitEvent("start", e), e.shiftKey && s && this._latestElement) {
      const l = this._latestElement, [a, d] = l.compareDocumentPosition(o) & 4 ? [o, l] : [l, o], _ = [
        ...this._selectables.filter((r) => r.compareDocumentPosition(a) & 4 && r.compareDocumentPosition(d) & 2),
        a,
        d
      ];
      this.select(_), this._latestElement = l;
    } else n.includes(o) && (n.length === 1 || e.ctrlKey || n.every((l) => this._selection.stored.includes(l))) ? this.deselect(o) : (this.select(o), this._latestElement = o);
  }
  _delayedTapMove(e) {
    const { container: t, document: s, behaviour: { startThreshold: i } } = this._options, { x1: o, y1: n } = this._areaLocation, { x: l, y: a } = E(e);
    if (typeof i == "number" && S(l + a - (o + n)) >= i || typeof i == "object" && S(l - o) >= i.x || S(a - n) >= i.y) {
      if (m(s, ["mousemove", "touchmove"], this._delayedTapMove, { passive: !1 }), this._emitEvent("beforedrag", e) === !1) {
        m(s, [
          "mouseup",
          "touchcancel",
          "touchend"
        ], this._onTapStop);
        return;
      }
      y(s, ["mousemove", "touchmove"], this._onTapMove, { passive: !1 }), v(this._area, "display", "block"), b(t, s)[0].appendChild(this._clippingElement), this.resolveSelectables(), this._singleClick = !1, this._targetRect = this._targetElement.getBoundingClientRect(), this._scrollAvailable = this._targetElement.scrollHeight !== this._targetElement.clientHeight || this._targetElement.scrollWidth !== this._targetElement.clientWidth, this._scrollAvailable && (y(this._targetElement, "wheel", this._wheelScroll, { passive: !1 }), y(this._options.document, "keydown", this._keyboardScroll, { passive: !1 }), this._selectables = this._selectables.filter((d) => this._targetElement.contains(d))), this._setupSelectionArea(), this._emitEvent("start", e), this._onTapMove(e);
    }
    this._handleMoveEvent(e);
  }
  _setupSelectionArea() {
    const { _clippingElement: e, _targetElement: t, _area: s } = this, i = this._targetRect = t.getBoundingClientRect();
    this._scrollAvailable ? (v(e, {
      top: i.top,
      left: i.left,
      width: i.width,
      height: i.height
    }), v(s, {
      marginTop: -i.top,
      marginLeft: -i.left
    })) : (v(e, {
      top: 0,
      left: 0,
      width: "100%",
      height: "100%"
    }), v(s, {
      marginTop: 0,
      marginLeft: 0
    }));
  }
  _onTapMove(e) {
    const { _scrollSpeed: t, _areaLocation: s, _options: i, _frame: o } = this, { speedDivider: n } = i.behaviour.scrolling, l = this._targetElement, { x: a, y: d } = E(e);
    if (s.x2 = a, s.y2 = d, this._lastMousePosition.x = a, this._lastMousePosition.y = d, this._scrollAvailable && !this._scrollingActive && (t.y || t.x)) {
      this._scrollingActive = !0;
      let _ = l.scrollTop, r = l.scrollLeft;
      const f = () => {
        if (!this._scrollingActive) return;
        t.y && (l.scrollTop += C(t.y / n)), t.x && (l.scrollLeft += C(t.x / n));
        const p = l.scrollTop - _, u = l.scrollLeft - r;
        s.y1 -= p, s.x1 -= u, _ = l.scrollTop, r = l.scrollLeft, o.next(e), t.x || t.y ? requestAnimationFrame(f) : this._scrollingActive = !1;
      };
      requestAnimationFrame(f);
    } else this._scrollingActive || o.next(e);
    this._handleMoveEvent(e);
  }
  _handleMoveEvent(e) {
    const { features: t } = this._options;
    (t.touch && X() || this._scrollAvailable && Y()) && e.preventDefault();
  }
  _onScroll() {
    const { _scrollDelta: e, _options: { document: t } } = this, { scrollTop: s, scrollLeft: i } = t.scrollingElement ?? t.body;
    this._areaLocation.x1 += e.x - i, this._areaLocation.y1 += e.y - s, e.x = i, e.y = s, this._setupSelectionArea(), this._frame.next(null);
  }
  _onStartAreaScroll() {
    this._targetBoundaryScrolled = !0, m(this._targetElement, "scroll", this._onStartAreaScroll);
  }
  _wheelScroll(e) {
    const { manualSpeed: t } = this._options.behaviour.scrolling, s = e.deltaY ? e.deltaY > 0 ? 1 : -1 : 0, i = e.deltaX ? e.deltaX > 0 ? 1 : -1 : 0;
    this._scrollSpeed.y += s * t, this._scrollSpeed.x += i * t, this._onTapMove(e), e.preventDefault();
  }
  _keyboardScroll(e) {
    const { manualSpeed: t } = this._options.behaviour.scrolling, s = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, i = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    this._scrollSpeed.x += Math.sign(s) * t, this._scrollSpeed.y += Math.sign(i) * t, e.preventDefault(), this._onTapMove({
      clientX: this._lastMousePosition.x,
      clientY: this._lastMousePosition.y,
      preventDefault: () => {
      }
    });
  }
  _recalculateSelectionAreaRect() {
    const { _scrollSpeed: e, _areaLocation: t, _targetElement: s, _options: i } = this, { scrollTop: o, scrollHeight: n, clientHeight: l, scrollLeft: a, scrollWidth: d, clientWidth: _ } = s, r = this._targetRect, { x1: f, y1: p } = t;
    let { x2: u, y2: h } = t;
    const { behaviour: { scrolling: { startScrollMargins: c } } } = i;
    u < r.left + c.x ? (e.x = a ? -S(r.left - u + c.x) : 0, u = u < r.left ? r.left : u) : u > r.right - c.x ? (e.x = d - a - _ ? S(r.left + r.width - u - c.x) : 0, u = u > r.right ? r.right : u) : e.x = 0, h < r.top + c.y ? (e.y = o ? -S(r.top - h + c.y) : 0, h = h < r.top ? r.top : h) : h > r.bottom - c.y ? (e.y = n - o - l ? S(r.top + r.height - h - c.y) : 0, h = h > r.bottom ? r.bottom : h) : e.y = 0;
    const g = k(f, u), A = k(p, h), D = M(f, u), O = M(p, h);
    this._areaRect = w(g, A, D - g, O - A);
  }
  _redrawSelectionArea() {
    const { x: e, y: t, width: s, height: i } = this._areaRect, { style: o } = this._area;
    o.left = `${e}px`, o.top = `${t}px`, o.width = `${s}px`, o.height = `${i}px`;
  }
  _onTapStop(e, t) {
    const { document: s, features: i } = this._options, { _singleClick: o } = this;
    m(this._targetElement, "scroll", this._onStartAreaScroll), m(s, ["mousemove", "touchmove"], this._delayedTapMove), m(s, ["touchmove", "mousemove"], this._onTapMove), m(s, [
      "mouseup",
      "touchcancel",
      "touchend"
    ], this._onTapStop), m(s, "scroll", this._onScroll), this._keepSelection(), e && o && i.singleTap.allow ? this._onSingleTap(e) : !o && !t && (this._updateElementSelection(), this._emitEvent("stop", e)), this._scrollSpeed.x = 0, this._scrollSpeed.y = 0, m(this._targetElement, "wheel", this._wheelScroll, { passive: !0 }), m(this._options.document, "keydown", this._keyboardScroll, { passive: !0 }), this._clippingElement.remove(), this._frame?.cancel(), v(this._area, "display", "none");
  }
  _updateElementSelection() {
    const { _selectables: e, _options: t, _selection: s, _areaRect: i } = this, { stored: o, selected: n, touched: l } = s, { intersect: a, overlap: d } = t.behaviour, _ = d === "invert", r = [], f = [], p = [];
    for (let h = 0; h < e.length; h++) {
      const c = e[h];
      if (L(i, c.getBoundingClientRect(), a)) {
        if (n.includes(c))
          o.includes(c) && !l.includes(c) && l.push(c);
        else if (_ && o.includes(c)) {
          p.push(c);
          continue;
        } else if (d === "drop" && o.includes(c)) {
          l.push(c), r.push(c);
          continue;
        } else f.push(c);
        r.push(c);
      }
    }
    _ && f.push(...o.filter((h) => !n.includes(h)));
    const u = d === "keep";
    for (let h = 0; h < n.length; h++) {
      const c = n[h];
      !r.includes(c) && !(u && o.includes(c)) && p.push(c);
    }
    s.selected = r, s.changed = {
      added: f,
      removed: p
    }, this._latestElement = void 0;
  }
  _emitEvent(e, t) {
    return this.emit(e, {
      event: t,
      store: this._selection,
      selection: this
    });
  }
  _keepSelection() {
    const { _options: e, _selection: t } = this, { selected: s, changed: i, touched: o, stored: n } = t, l = s.filter((a) => !n.includes(a));
    switch (e.behaviour.overlap) {
      case "drop":
        t.stored = [...l, ...n.filter((a) => !o.includes(a))];
        break;
      case "invert":
        t.stored = [...l, ...n.filter((a) => !i.removed.includes(a))];
        break;
      case "keep":
        t.stored = [...n, ...s.filter((a) => !n.includes(a))];
    }
  }
  trigger(e, t = !0) {
    this._onTapStart(e, t);
  }
  resolveSelectables() {
    this._selectables = b(this._options.selectables, this._options.document);
  }
  clearSelection(e = !0, t = !1) {
    const { selected: s, stored: i, changed: o } = this._selection;
    o.added = [], o.removed.push(...s, ...e ? i : []), t || (this._emitEvent("move", null), this._emitEvent("stop", null)), this._selection = B(e ? [] : i);
  }
  getSelection() {
    return this._selection.stored;
  }
  getSelectionArea() {
    return this._area;
  }
  getSelectables() {
    return this._selectables;
  }
  setAreaLocation(e) {
    Object.assign(this._areaLocation, e), this._redrawSelectionArea();
  }
  getAreaLocation() {
    return this._areaLocation;
  }
  cancel(e = !1) {
    this._onTapStop(null, !e);
  }
  destroy() {
    this.cancel(), this.disable(), this._clippingElement.remove(), super.unbindAllListeners();
  }
  enable = this._toggleStartEvents;
  disable = this._toggleStartEvents.bind(this, !1);
  select(e, t = !1) {
    const { changed: s, selected: i, stored: o } = this._selection, n = b(e, this._options.document).filter((l, a, d) => !i.includes(l) && !o.includes(l) && d.indexOf(l) === a);
    return o.push(...n), i.push(...n), s.added.push(...n), s.removed = [], this._latestElement = void 0, t || (this._emitEvent("move", null), this._emitEvent("stop", null)), n;
  }
  deselect(e, t = !1) {
    const { selected: s, stored: i, changed: o } = this._selection, n = b(e, this._options.document).filter((l) => s.includes(l) || i.includes(l));
    this._selection.stored = i.filter((l) => !n.includes(l)), this._selection.selected = s.filter((l) => !n.includes(l)), this._selection.changed.added = [], this._selection.changed.removed.push(...n.filter((l) => !o.removed.includes(l))), this._latestElement = void 0, t || (this._emitEvent("move", null), this._emitEvent("stop", null));
  }
};
export {
  H as default
};

//# sourceMappingURL=viselect.js.map