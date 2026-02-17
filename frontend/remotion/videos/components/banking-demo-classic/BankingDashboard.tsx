import { interpolate, spring } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type BankingDashboardProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  panelWidth: number;
  accentColor: string;
};

// Transaction data for the recent transactions list
const TRANSACTIONS = [
  { name: "Netflix", amount: "-$15.99", date: "Yesterday", icon: "🎬" },
  { name: "Whole Foods", amount: "-$87.43", date: "2 days ago", icon: "🥬" },
  { name: "Transfer to Savings", amount: "-$500.00", date: "3 days ago", icon: "💰" },
  { name: "Spotify", amount: "-$9.99", date: "4 days ago", icon: "🎵" },
];

// Quick action buttons
const QUICK_ACTIONS = [
  { label: "Send Money", icon: "↗" },
  { label: "Pay Bills", icon: "📋" },
  { label: "Add Funds", icon: "+" },
  { label: "Request", icon: "↙" },
];

export const BankingDashboard = ({
  frame,
  fps,
  floatOffset,
  panelWidth,
  accentColor,
}: BankingDashboardProps) => {
  // Highlight "Send Money" button when navigating to payment screen
  const highlightSendMoney = frame >= SCENE_TIMING.NAVIGATE_PAYMENT - 30 && 
                              frame < SCENE_TIMING.NAVIGATE_PAYMENT + 10;
  
  const sendMoneyPulse = highlightSendMoney
    ? spring({
        frame: frame - (SCENE_TIMING.NAVIGATE_PAYMENT - 30),
        fps,
        config: { damping: 10, stiffness: 300 },
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: panelWidth,
        bottom: 0,
        backgroundColor: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        transform: `translateY(${floatOffset * 0.3}px)`,
      }}
    >
      {/* Top Navigation Bar */}
      <div
        style={{
          height: 72,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 20,
              fontWeight: 700,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            A
          </div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1A1A1A",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Apex Bank
          </span>
        </div>

        {/* Nav Items */}
        <div style={{ display: "flex", gap: 40 }}>
          {["Accounts", "Payments", "Cards", "Insights"].map((item, i) => (
            <span
              key={item}
              style={{
                fontSize: 16,
                fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? accentColor : "#64748B",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                cursor: "pointer",
              }}
            >
              {item}
            </span>
          ))}
        </div>

        {/* User Avatar */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "#E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            color: "#64748B",
          }}
        >
          👤
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          padding: "40px 60px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* Account Summary Card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: "32px 40px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                color: "#64748B",
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Checking Account ••••4892
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#1A1A1A",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                letterSpacing: -1,
              }}
            >
              $12,847.32
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#64748B",
                marginTop: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Available: $12,347.32
            </div>
          </div>

          {/* Mini Sparkline Chart (static decorative) */}
          <svg width="200" height="60" viewBox="0 0 200 60">
            <path
              d="M0 40 Q20 35 40 38 T80 30 T120 35 T160 25 T200 28"
              fill="none"
              stroke={accentColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M0 40 Q20 35 40 38 T80 30 T120 35 T160 25 T200 28 V60 H0 Z"
              fill={`${accentColor}15`}
            />
          </svg>
        </div>

        {/* Quick Actions Row */}
        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          {QUICK_ACTIONS.map((action, index) => {
            const isHighlighted = index === 0 && highlightSendMoney;
            const pulseScale = isHighlighted ? 1 + sendMoneyPulse * 0.05 : 1;
            const pulseGlow = isHighlighted ? sendMoneyPulse * 0.4 : 0;

            return (
              <div
                key={action.label}
                style={{
                  flex: 1,
                  backgroundColor: isHighlighted ? accentColor : "#FFFFFF",
                  borderRadius: 16,
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: isHighlighted
                    ? `0 4px 20px rgba(59, 130, 246, ${0.3 + pulseGlow})`
                    : "0 2px 8px rgba(0, 0, 0, 0.04)",
                  cursor: "pointer",
                  transform: `scale(${pulseScale})`,
                  transition: "none",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: isHighlighted ? "rgba(255,255,255,0.2)" : "#F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: isHighlighted ? "#FFFFFF" : accentColor,
                  }}
                >
                  {action.icon}
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: isHighlighted ? "#FFFFFF" : "#1A1A1A",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {action.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: "28px 32px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: 20,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Recent Transactions
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {TRANSACTIONS.map((tx, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: index < TRANSACTIONS.length - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "#F8FAFC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {tx.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: "#1A1A1A",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {tx.name}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#94A3B8",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {tx.date}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {tx.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
