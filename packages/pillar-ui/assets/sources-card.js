import { jsxs as c, jsx as o } from "react/jsx-runtime";
import x from "react-dom";
import m, { useSyncExternalStore as y } from "react";
var a = {}, f, l = x;
if (process.env.NODE_ENV === "production")
  f = a.createRoot = l.createRoot, a.hydrateRoot = l.hydrateRoot;
else {
  var d = l.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  f = a.createRoot = function(e, n) {
    d.usingClientEntryPoint = !0;
    try {
      return l.createRoot(e, n);
    } finally {
      d.usingClientEntryPoint = !1;
    }
  }, a.hydrateRoot = function(e, n, r) {
    d.usingClientEntryPoint = !0;
    try {
      return l.hydrateRoot(e, n, r);
    } finally {
      d.usingClientEntryPoint = !1;
    }
  };
}
function v(e) {
  if (!e)
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2"%3E%3Cpath d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"%3E%3C/path%3E%3Cpolyline points="14 2 14 8 20 8"%3E%3C/polyline%3E%3C/svg%3E';
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(e).origin}&sz=32`;
  } catch {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2"%3E%3Cpath d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"%3E%3C/path%3E%3Cpath d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"%3E%3C/path%3E%3C/svg%3E';
  }
}
function E({
  source: e,
  theme: n
}) {
  const r = v(e.url), t = n === "dark", s = () => {
    e.url && window.openai?.openExternal ? window.openai.openExternal({ href: e.url }) : e.url && window.open(e.url, "_blank", "noopener,noreferrer");
  }, u = {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    borderRadius: "8px",
    border: `1px solid ${t ? "#3f3f46" : "#e5e7eb"}`,
    backgroundColor: t ? "#18181b" : "#ffffff",
    cursor: e.url ? "pointer" : "default",
    transition: "all 0.2s ease"
  };
  return /* @__PURE__ */ c(
    "div",
    {
      onClick: s,
      style: u,
      onMouseEnter: (i) => {
        e.url && (i.currentTarget.style.backgroundColor = t ? "#27272a" : "#f9fafb", i.currentTarget.style.borderColor = t ? "#52525b" : "#d1d5db");
      },
      onMouseLeave: (i) => {
        i.currentTarget.style.backgroundColor = t ? "#18181b" : "#ffffff", i.currentTarget.style.borderColor = t ? "#3f3f46" : "#e5e7eb";
      },
      children: [
        /* @__PURE__ */ o(
          "div",
          {
            style: {
              flexShrink: 0,
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: /* @__PURE__ */ o(
              "img",
              {
                src: r,
                alt: "",
                style: {
                  width: "20px",
                  height: "20px",
                  objectFit: "contain"
                },
                onError: (i) => {
                  i.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2"%3E%3Ccircle cx="12" cy="12" r="10"%3E%3C/circle%3E%3Cline x1="12" y1="16" x2="12" y2="12"%3E%3C/line%3E%3Cline x1="12" y1="8" x2="12.01" y2="8"%3E%3C/line%3E%3C/svg%3E';
                }
              }
            )
          }
        ),
        /* @__PURE__ */ c("div", { style: { flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ o(
            "div",
            {
              style: {
                fontSize: "14px",
                fontWeight: 500,
                color: t ? "#fafafa" : "#18181b",
                marginBottom: "4px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical"
              },
              children: e.title || "Untitled"
            }
          ),
          e.url && /* @__PURE__ */ o(
            "div",
            {
              style: {
                fontSize: "12px",
                color: t ? "#a1a1aa" : "#71717a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              },
              children: (() => {
                try {
                  return new URL(e.url).hostname;
                } catch {
                  return e.url;
                }
              })()
            }
          ),
          e.type === "document" && /* @__PURE__ */ o(
            "div",
            {
              style: {
                fontSize: "11px",
                color: t ? "#a1a1aa" : "#71717a",
                marginTop: "4px",
                padding: "2px 6px",
                backgroundColor: t ? "#27272a" : "#f4f4f5",
                borderRadius: "4px",
                display: "inline-block"
              },
              children: "Document"
            }
          )
        ] }),
        e.citation_number && /* @__PURE__ */ o(
          "div",
          {
            style: {
              flexShrink: 0,
              width: "24px",
              height: "24px",
              borderRadius: "12px",
              backgroundColor: t ? "#3f3f46" : "#e5e7eb",
              color: t ? "#fafafa" : "#18181b",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: e.citation_number
          }
        )
      ]
    }
  );
}
function w({ sources: e, theme: n = "light" }) {
  return !e || e.length === 0 ? null : /* @__PURE__ */ c(
    "div",
    {
      style: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: "16px",
        maxWidth: "100%"
      },
      children: [
        /* @__PURE__ */ o(
          "h3",
          {
            style: {
              fontSize: "16px",
              fontWeight: 600,
              color: n === "dark" ? "#fafafa" : "#18181b",
              marginBottom: "12px",
              marginTop: 0
            },
            children: "Sources"
          }
        ),
        /* @__PURE__ */ o(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            },
            children: e.map((t, s) => /* @__PURE__ */ o(E, { source: t, theme: n }, s))
          }
        )
      ]
    }
  );
}
const p = "openai:set_globals";
function g(e) {
  return y(
    (n) => {
      const r = (t) => {
        t.detail.globals[e] !== void 0 && n();
      };
      return window.addEventListener(p, r, {
        passive: !0
      }), () => {
        window.removeEventListener(p, r);
      };
    },
    () => window.openai?.[e]
  );
}
function C() {
  return g("toolOutput") ?? null;
}
function b() {
  return g("theme") ?? "light";
}
function h() {
  const e = C(), n = b(), r = e?.sources;
  return !r || r.length === 0 ? null : /* @__PURE__ */ o(w, { sources: r, theme: n });
}
if (typeof document < "u") {
  const e = document.getElementById("root");
  e && a.createRoot(e).render(
    /* @__PURE__ */ o(m.StrictMode, { children: /* @__PURE__ */ o(h, {}) })
  );
}
f(document.getElementById("sources-card-root")).render(
  /* @__PURE__ */ o(h, {})
);
const _ = void 0;
export {
  _ as default
};
