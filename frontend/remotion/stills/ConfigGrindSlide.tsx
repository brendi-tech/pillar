import { AbsoluteFill } from "remotion";

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO_FONT =
  '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace';

if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";
  document.head.appendChild(link);
}

const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  accent: "#FF6E00",
  red: "#EF4444",
  green: "#10B981",
  greenLight: "#D1FAE5",
  dropdown: "#F9FAFB",
};

const PillarLogoFull = ({ width = 99 }: { width?: number }) => {
  const scale = width / 99;
  const maskStyle: React.CSSProperties = { maskType: "alpha" };
  return (
    <svg width={99 * scale} height={34 * scale} viewBox="0 0 99 34" fill="none">
      <path
        fill="#1A1A1A"
        d="m38.241 27.593.197-.065q.294-.098.49-.262.197-.163.327-.523.131-.393.197-1.014.065-.655.065-1.636V9.73q0-.982-.065-1.603-.066-.655-.197-1.015-.13-.392-.327-.556a1.5 1.5 0 0 0-.49-.261l-.197-.033v-.916h7.002q2.06 0 3.5.392 1.473.36 2.454.982 1.015.621 1.57 1.374.59.72.884 1.472.327.752.393 1.407.098.622.098 1.014 0 1.734-.655 3.141a6.5 6.5 0 0 1-1.897 2.389q-1.21.981-2.945 1.505-1.733.523-3.926.523h-1.995v4.548q0 .981.032 1.636.066.621.197 1.014.13.36.327.523.229.165.523.262l.196.065v.884h-5.758zm6.413-9.062q2.977 0 4.515-1.473 1.57-1.505 1.57-4.35 0-.884-.229-1.964a5.3 5.3 0 0 0-.916-2.061q-.687-.95-1.996-1.603-1.275-.655-3.402-.655h-1.472v12.106zM57.232 9.599a1.96 1.96 0 0 1-1.44-.589 2.07 2.07 0 0 1-.588-1.472q0-.884.589-1.473a1.96 1.96 0 0 1 1.44-.588q.882 0 1.472.588.589.59.589 1.473 0 .85-.622 1.472a1.96 1.96 0 0 1-1.44.589m3.043 17.896v.884h-5.66v-.884l.196-.065q.295-.099.491-.262.23-.163.36-.523.131-.393.196-1.015.066-.654.066-1.636v-7.197q0-.85-.099-1.342-.065-.49-.196-.752-.13-.294-.327-.393a1.4 1.4 0 0 0-.458-.13l-.23-.033v-.884l3.567-1.603.524-.033h.261v12.367q0 .982.066 1.636.065.622.196 1.015.165.36.36.523.196.164.49.262zM66.233 27.495v.884h-5.66v-.884l.196-.065q.295-.099.491-.262.23-.163.36-.523.131-.393.196-1.015.066-.654.066-1.636v-13.38q0-.851-.099-1.31-.065-.49-.196-.752-.13-.294-.327-.393a1.4 1.4 0 0 0-.458-.13l-.229-.033v-.884l3.566-1.635h.785v18.518q0 .982.066 1.635.065.622.196 1.015.165.36.36.523t.49.262zM72.23 27.495v.884h-5.66v-.884l.196-.065q.294-.099.49-.262.23-.163.36-.523.131-.393.197-1.015.065-.654.065-1.636v-13.38q0-.851-.098-1.31-.066-.49-.196-.752-.132-.294-.328-.393a1.4 1.4 0 0 0-.457-.13l-.23-.033v-.884l3.567-1.635h.785v18.518q0 .982.065 1.635.066.622.197 1.015.163.36.36.523.195.164.49.262zM88 27.462v.722h-.753q-.72 0-1.341-.08a4 4 0 0 1-1.113-.294 2.3 2.3 0 0 1-.752-.615q-.296-.373-.36-.935a5.8 5.8 0 0 1-1.374 1.096q-.72.427-1.865.774-1.113.348-2.716.348-1.112 0-2.126-.24a6.2 6.2 0 0 1-1.734-.695 4 4 0 0 1-1.21-1.176q-.427-.72-.426-1.683 0-1.095.687-1.87.72-.801 1.832-1.362a13 13 0 0 1 2.52-.935 54 54 0 0 1 2.813-.721l3.599-.802q0-2.084-.818-3.019-.786-.96-2.748-.961a3.5 3.5 0 0 0-1.407.267 4.5 4.5 0 0 0-1.113.614q-.458.375-.785.828-.327.428-.589.802-.72 1.041-1.701 1.042a2 2 0 0 1-.654-.107 1.12 1.12 0 0 1-.687-.535q-.197-.426.13-.961.263-.455.818-.935.556-.508 1.407-.909a10 10 0 0 1 1.996-.667q1.145-.268 2.552-.268t2.617.348 2.094 1.015q.916.641 1.407 1.603.523.934.523 2.164v5.289q0 .801.033 1.336.066.507.197.828a1 1 0 0 0 .327.427q.229.134.523.214zm-4.32-7.666-3.304.748q-.884.186-1.766.48a6.2 6.2 0 0 0-1.538.775q-.654.48-1.08 1.202-.392.722-.392 1.763 0 .615.261 1.122.296.508.72.882.458.374 1.047.588.622.213 1.243.213 1.244 0 2.094-.294.85-.32 1.407-.72.59-.401.883-.776.328-.373.426-.507zM97.416 14.506q.72.16.949.534.262.348.196.668-.065.4-.425.668-.327.267-.785.267-.262 0-.491-.027a18 18 0 0 0-.49-.106l-.524-.107a2.8 2.8 0 0 0-.556-.054q-1.048 0-1.702.561a3.6 3.6 0 0 0-.981 1.336v6.331q0 .802.065 1.336.066.507.196.828.165.294.36.428.197.134.491.213l.196.054v.721h-5.66v-.721l.197-.054a1.6 1.6 0 0 0 .49-.213.9.9 0 0 0 .36-.428q.13-.321.197-.828.065-.534.065-1.336v-6.09q0-.695-.098-1.096-.066-.4-.197-.614a.7.7 0 0 0-.327-.294 1.7 1.7 0 0 0-.458-.107l-.229-.053V15.6l3.566-1.068.524-.027h.262v1.95q.72-.801 1.8-1.416a4.56 4.56 0 0 1 2.29-.614q.392 0 .72.08"
      />
      <mask id="cgs-mask" width="34" height="34" x="0" y="0" maskUnits="userSpaceOnUse" style={maskStyle}>
        <circle cx="16.912" cy="16.912" r="16.912" fill="#1A1A1A" />
      </mask>
      <g mask="url(#cgs-mask)">
        <circle cx="16.912" cy="16.912" r="16.405" stroke="#1A1A1A" strokeWidth="1.012" />
        <path fill="#1A1A1A" d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z" />
      </g>
    </svg>
  );
};

const PillarLogoMark = ({ size = 28 }: { size?: number }) => {
  const scale = size / 34;
  const maskStyle: React.CSSProperties = { maskType: "alpha" };
  return (
    <svg width={34 * scale} height={34 * scale} viewBox="0 0 34 34" fill="none">
      <mask id="cgs-mark-mask" width="34" height="34" x="0" y="0" maskUnits="userSpaceOnUse" style={maskStyle}>
        <circle cx="17" cy="17" r="17" fill="#1A1A1A" />
      </mask>
      <circle cx="17" cy="17" r="16.5" stroke="#1A1A1A" strokeWidth="1" />
      <g mask="url(#cgs-mark-mask)">
        <path fill="#1A1A1A" d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z" />
      </g>
    </svg>
  );
};

const TriggerBuilderUI = () => {
  const sidebarItems = [
    { label: "Dashboard", active: false, indent: false },
    { label: "Channels", active: false, indent: false },
    { label: "Objects and rules", active: true, indent: false },
    { label: "Triggers", active: true, indent: true },
    { label: "Automations", active: false, indent: true },
    { label: "SLA policies", active: false, indent: true },
    { label: "Macros", active: false, indent: true },
  ];

  const conditions = [
    { field: "Subject", op: "Contains", value: "billing" },
    { field: "Subject", op: "Contains", value: "invoice" },
    { field: "Subject", op: "Contains", value: "payment" },
  ];

  const actions = [
    { field: "Priority", value: "High" },
    { field: "Group", value: "Finance" },
  ];

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      borderRadius: 12,
      overflow: "hidden",
      border: `1px solid ${COLORS.border}`,
      boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        width: 140,
        backgroundColor: "#1B1B2F",
        padding: "12px 0",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        flexShrink: 0,
      }}>
        <div style={{ padding: "4px 12px 10px", fontFamily: FONT, fontSize: 10, fontWeight: 700, color: "white" }}>
          Admin Center
        </div>
        {sidebarItems.map((item, i) => (
          <div key={i} style={{
            padding: `3px ${item.indent ? 24 : 12}px`,
            fontFamily: FONT, fontSize: 9, fontWeight: item.active ? 600 : 400,
            color: item.active ? "white" : "rgba(255,255,255,0.4)",
            backgroundColor: item.active && !item.indent ? "rgba(255,255,255,0.1)" : "transparent",
            borderLeft: item.active ? `2px solid ${COLORS.accent}` : "2px solid transparent",
          }}>
            {item.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, backgroundColor: COLORS.surface, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
          <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: COLORS.text }}>New Trigger</span>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Trigger name</span>
            <div style={{ padding: "4px 8px", border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 9, color: COLORS.text }}>Route billing tickets</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Conditions</span>
            {conditions.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <div style={{ padding: "3px 5px", backgroundColor: COLORS.dropdown, border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 8, color: COLORS.text }}>{c.field} ▾</div>
                <div style={{ padding: "3px 5px", backgroundColor: COLORS.dropdown, border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 8, color: COLORS.text }}>{c.op} ▾</div>
                <div style={{ padding: "3px 5px", border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 8, color: COLORS.text, flex: 1 }}>{c.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: FONT, fontSize: 8, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</span>
            {actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <div style={{ padding: "3px 5px", backgroundColor: COLORS.dropdown, border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 8, color: COLORS.text }}>{a.field} ▾</div>
                <div style={{ padding: "3px 5px", border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 8, color: COLORS.text, flex: 1 }}>{a.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", display: "flex", gap: 4 }}>
            <div style={{ padding: "4px 10px", backgroundColor: "#4F46E5", color: "white", borderRadius: 3, fontFamily: FONT, fontSize: 9, fontWeight: 600 }}>Save</div>
            <div style={{ padding: "4px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 3, fontFamily: FONT, fontSize: 9, color: COLORS.textMuted }}>Cancel</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PillarChat = () => {
  const steps = [
    "Found 3 matching conditions",
    "Set priority → High",
    "Assigned group → Finance",
    "Trigger saved",
  ];

  return (
    <div style={{
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
      overflow: "hidden",
      width: "100%",
    }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <PillarLogoMark size={20} />
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLORS.text }}>Pillar</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          padding: "10px 14px",
          backgroundColor: COLORS.dropdown,
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          fontFamily: FONT, fontSize: 13, color: COLORS.text, lineHeight: 1.5,
        }}>
          Route all billing, invoice, and payment tickets to Finance with high priority
        </div>
      </div>
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: COLORS.greenLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 12, color: COLORS.text, fontWeight: 500 }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ConfigGrindSlide = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 60px" }}>
        <PillarLogoFull width={140} />
        <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 500, color: COLORS.textLight }}>
          Configuration-heavy products
        </span>
      </div>

      {/* Main: left / VS / right */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        padding: "0 60px 20px",
        gap: 0,
      }}>
        {/* LEFT: 30 clicks */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}>
          {/* Big number */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: MONO_FONT,
              fontSize: 140,
              fontWeight: 900,
              color: COLORS.red,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}>
              30
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 36,
              fontWeight: 800,
              color: COLORS.text,
              letterSpacing: "-0.02em",
              marginTop: 4,
            }}>
              clicks
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 20,
              fontWeight: 500,
              color: COLORS.textMuted,
              marginTop: 8,
            }}>
              to set up one trigger
            </div>
          </div>

          {/* Trigger UI — fixed height, full width */}
          <div style={{ width: "100%", height: 300 }}>
            <TriggerBuilderUI />
          </div>
        </div>

        {/* CENTER: VS */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          gap: 0,
          alignSelf: "stretch",
        }}>
          <div style={{
            width: 2,
            flex: 1,
            background: `linear-gradient(180deg, transparent 0%, ${COLORS.border} 30%, ${COLORS.border} 70%, transparent 100%)`,
          }} />
          <div style={{
            fontFamily: FONT,
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.text,
            lineHeight: 1,
            padding: "16px 0",
            letterSpacing: "-0.02em",
          }}>
            VS
          </div>
          <div style={{
            width: 2,
            flex: 1,
            background: `linear-gradient(180deg, transparent 0%, ${COLORS.border} 30%, ${COLORS.border} 70%, transparent 100%)`,
          }} />
        </div>

        {/* RIGHT: 14 words */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}>
          {/* Big number */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: MONO_FONT,
              fontSize: 140,
              fontWeight: 900,
              color: COLORS.green,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}>
              14
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 36,
              fontWeight: 800,
              color: COLORS.text,
              letterSpacing: "-0.02em",
              marginTop: 4,
            }}>
              words
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 20,
              fontWeight: 500,
              color: COLORS.textMuted,
              marginTop: 8,
            }}>
              same result
            </div>
          </div>

          {/* Pillar chat — full width */}
          <div style={{ width: "100%" }}>
            <PillarChat />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0 60px 28px", textAlign: "center" }}>
        <span style={{ fontFamily: FONT, fontSize: 19, color: COLORS.textMuted, fontWeight: 500 }}>
          Helpdesk admins build 20–50 triggers per instance. Each one is 30 clicks. Pillar does it in one sentence.
        </span>
      </div>
    </AbsoluteFill>
  );
};
