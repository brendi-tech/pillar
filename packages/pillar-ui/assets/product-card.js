import { jsxs as s, jsx as n } from "react/jsx-runtime";
import h from "react-dom";
import y, { useSyncExternalStore as v } from "react";
var d = {}, f, l = h;
if (process.env.NODE_ENV === "production")
  f = d.createRoot = l.createRoot, d.hydrateRoot = l.hydrateRoot;
else {
  var c = l.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  f = d.createRoot = function(e, r) {
    c.usingClientEntryPoint = !0;
    try {
      return l.createRoot(e, r);
    } finally {
      c.usingClientEntryPoint = !1;
    }
  }, d.hydrateRoot = function(e, r, o) {
    c.usingClientEntryPoint = !0;
    try {
      return l.hydrateRoot(e, r, o);
    } finally {
      c.usingClientEntryPoint = !1;
    }
  };
}
function _({
  product: e,
  theme: r,
  onProductClick: o
}) {
  const t = r === "dark", i = () => {
    o && o(e);
  }, u = {
    display: "flex",
    flexDirection: "column",
    borderRadius: "8px",
    border: `1px solid ${t ? "#3f3f46" : "#e5e7eb"}`,
    backgroundColor: t ? "#18181b" : "#ffffff",
    overflow: "hidden",
    cursor: o && e.product_url ? "pointer" : "default",
    transition: "all 0.2s ease"
  }, p = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="%23e5e7eb"%3E%3Crect width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
  return /* @__PURE__ */ s(
    "div",
    {
      onClick: i,
      style: u,
      onMouseEnter: (a) => {
        o && e.product_url && (a.currentTarget.style.transform = "translateY(-2px)", a.currentTarget.style.boxShadow = t ? "0 4px 12px rgba(0, 0, 0, 0.3)" : "0 4px 12px rgba(0, 0, 0, 0.1)");
      },
      onMouseLeave: (a) => {
        o && e.product_url && (a.currentTarget.style.transform = "translateY(0)", a.currentTarget.style.boxShadow = "none");
      },
      children: [
        /* @__PURE__ */ n(
          "div",
          {
            style: {
              width: "100%",
              aspectRatio: "4 / 3",
              backgroundColor: t ? "#27272a" : "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            },
            children: e.image_url ? /* @__PURE__ */ n(
              "img",
              {
                src: e.image_url,
                alt: e.title,
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                },
                onError: (a) => {
                  a.currentTarget.src = p;
                }
              }
            ) : /* @__PURE__ */ n(
              "img",
              {
                src: p,
                alt: "",
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }
              }
            )
          }
        ),
        /* @__PURE__ */ s("div", { style: { padding: "12px" }, children: [
          e.vendor && /* @__PURE__ */ n(
            "div",
            {
              style: {
                fontSize: "11px",
                color: t ? "#a1a1aa" : "#71717a",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              },
              children: e.vendor
            }
          ),
          /* @__PURE__ */ n(
            "div",
            {
              style: {
                fontSize: "14px",
                fontWeight: 600,
                color: t ? "#fafafa" : "#18181b",
                marginBottom: "8px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: "1.4"
              },
              children: e.title
            }
          ),
          e.price_range.display && /* @__PURE__ */ n(
            "div",
            {
              style: {
                fontSize: "16px",
                fontWeight: 700,
                color: t ? "#fafafa" : "#18181b",
                marginBottom: "8px"
              },
              children: e.price_range.display
            }
          ),
          /* @__PURE__ */ s(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px"
              },
              children: [
                e.available_for_sale ? /* @__PURE__ */ n(
                  "div",
                  {
                    style: {
                      fontSize: "12px",
                      color: "#22c55e",
                      fontWeight: 500
                    },
                    children: "Available"
                  }
                ) : /* @__PURE__ */ n(
                  "div",
                  {
                    style: {
                      fontSize: "12px",
                      color: t ? "#ef4444" : "#dc2626",
                      fontWeight: 500
                    },
                    children: "Out of Stock"
                  }
                ),
                e.variant_count > 1 && /* @__PURE__ */ s(
                  "div",
                  {
                    style: {
                      fontSize: "11px",
                      color: t ? "#a1a1aa" : "#71717a"
                    },
                    children: [
                      e.variant_count,
                      " variants"
                    ]
                  }
                )
              ]
            }
          ),
          e.product_type && /* @__PURE__ */ n(
            "div",
            {
              style: {
                fontSize: "11px",
                color: t ? "#a1a1aa" : "#71717a",
                padding: "4px 8px",
                backgroundColor: t ? "#27272a" : "#f4f4f5",
                borderRadius: "4px",
                display: "inline-block",
                marginBottom: "8px"
              },
              children: e.product_type
            }
          ),
          e.product_url && /* @__PURE__ */ n(
            "div",
            {
              style: {
                fontSize: "13px",
                color: t ? "#60a5fa" : "#2563eb",
                fontWeight: 500,
                marginTop: "8px",
                textDecoration: "none"
              },
              children: "View Product →"
            }
          )
        ] })
      ]
    }
  );
}
function b({
  products: e,
  theme: r = "light",
  onProductClick: o
}) {
  return !e || e.length === 0 ? null : /* @__PURE__ */ s(
    "div",
    {
      style: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: "16px",
        maxWidth: "100%"
      },
      children: [
        /* @__PURE__ */ n(
          "h3",
          {
            style: {
              fontSize: "16px",
              fontWeight: 600,
              color: r === "dark" ? "#fafafa" : "#18181b",
              marginBottom: "16px",
              marginTop: 0
            },
            children: "Products"
          }
        ),
        /* @__PURE__ */ n(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px"
            },
            children: e.map((i) => /* @__PURE__ */ n(
              _,
              {
                product: i,
                theme: r,
                onProductClick: o
              },
              i.id
            ))
          }
        )
      ]
    }
  );
}
const g = "openai:set_globals";
function m(e) {
  return v(
    (r) => {
      const o = (t) => {
        t.detail.globals[e] !== void 0 && r();
      };
      return window.addEventListener(g, o, {
        passive: !0
      }), () => {
        window.removeEventListener(g, o);
      };
    },
    () => window.openai?.[e]
  );
}
function E() {
  return m("toolOutput") ?? null;
}
function w() {
  return m("theme") ?? "light";
}
function x() {
  const e = E(), r = w(), o = e?.products, t = (i) => {
    i.product_url && window.openai?.openExternal ? window.openai.openExternal({ href: i.product_url }) : i.product_url && window.open(i.product_url, "_blank", "noopener,noreferrer");
  };
  return !o || o.length === 0 ? null : /* @__PURE__ */ n(
    b,
    {
      products: o,
      theme: r,
      onProductClick: t
    }
  );
}
if (typeof document < "u") {
  const e = document.getElementById("root");
  e && d.createRoot(e).render(
    /* @__PURE__ */ n(y.StrictMode, { children: /* @__PURE__ */ n(x, {}) })
  );
}
f(document.getElementById("product-card-root")).render(
  /* @__PURE__ */ n(x, {})
);
const T = void 0;
export {
  T as default
};
