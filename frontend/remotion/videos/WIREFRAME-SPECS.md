# Wireframe Video Specs

Detailed animation specs for each of the 5 wireframe-only Remotion compositions.
These render at **1080x1080** (square) and sit in the right column of the hybrid
`TechnicalShowcase` layout. The left column (React step timeline) is synced to
the video via `video.currentTime`.

---

## Shared conventions

All wireframes follow these patterns:

- **Container**: dashed `2px` border (`#E5E7EB`), `border-radius: 20px`, white bg (`#FFFFFF`), centered in the 1080x1080 frame with `padding: 20px`. Max width ~700px (larger than the old 560px since the video is now square and has full space).
- **Component label**: positioned `top: -14px, left: 32px` over the dashed border. Mono font, 16px, `#9CA3AF`. Shows a JSX-style tag like `<PaymentForm>`.
- **Spring config**: `{ damping: 18, stiffness: 100, mass: 0.8 }` for all step transitions.
- **Step activation delay**: each animation starts 15-20 frames after its step activates (gives the timeline time to update first).
- **Background**: `#FAFAFA` (the composition background behind the dashed container).

### Timing reference

All 5 demos use the same timing structure (from `constants.ts`):

| Constant | Value | Meaning |
|---|---|---|
| `STEPS_START_FRAME` | 60 | First step activates (2s into video) |
| `VIDEO_FPS` | 30 | Frames per second |
| `TOTAL_DURATION_FRAMES` | 540 | Total video length (18s) |

Step activation frames for a typical 4-step demo (105/110/110/105 frame durations):

| Step | Activates at frame | Time | Duration |
|---|---|---|---|
| Step 0 (PILLAR) | 60 | 2.0s | 105 frames (3.5s) |
| Step 1 (YOUR APP) | 165 | 5.5s | 110 frames (3.7s) |
| Step 2 (YOUR APP) | 275 | 9.2s | 110 frames (3.7s) |
| Step 3 (DONE) | 385 | 12.8s | 105 frames (3.5s) |

After the last step, the video holds for ~5s showing the completed state before looping.

### Colors

| Token | Value | Usage |
|---|---|---|
| `wireframe.background` | `#FFFFFF` | Card/container bg |
| `wireframe.border` | `#E5E7EB` | Default borders |
| `wireframe.placeholder` | `#F3F4F6` | Skeleton placeholders |
| `wireframe.accent` | `#FF6E00` | Active/highlighted borders |
| `wireframe.text` | `#374151` | Primary text |
| `wireframe.textLight` | `#9CA3AF` | Labels and secondary text |

### Fonts

- **Sans**: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
- **Mono**: `SF Mono, Monaco, Menlo, Consolas, monospace`

---

## 1. Banking: `<PaymentForm>`

**File**: `components/wireframes/BankingWireframe.tsx`
**Component label**: `<PaymentForm>`
**Concept**: Zoomed-in payment form. Fields fill progressively as steps complete.

### Layout

```
+----------------------------------+
|  <PaymentForm>                   |   (dashed border, component label)
|                                  |
|  RECIPIENT                       |   (label, uppercase, 15px, textLight)
|  [____________________________]  |   (input: h56, r10, border)
|                                  |
|  AMOUNT                          |
|  [____________________________]  |   (input: h56, r10, border)
|                                  |
|  ┌──── Preview Card ────┐        |   (green bg, appears at step 2)
|  │ Send to Maria  $200  │        |
|  │ Date: Today · Fee: 0 │        |
|  └──────────────────────┘        |
|                                  |
|  [ Send $200.00 ]                |   (button: h52, accent bg)
+----------------------------------+
```

### Animation sequence

| Step | What happens | Trigger |
|---|---|---|
| Step 0 (PILLAR) | Container fades from 0.3 to 1.0 opacity. Fields show grey skeleton placeholders (70%/40% width bars). Button at 0.3 opacity. | `activeStepIndex >= 0`, +15 frame delay |
| Step 1 (YOUR APP - find payee) | Recipient field: border turns accent orange. Skeleton replaced by green avatar circle (36px, "M") + "Maria (Cleaner)" text. Spring fade-in. | `activeStepIndex >= 1`, +20 frame delay |
| Step 2 (YOUR APP - fill form) | Amount field: border turns accent. Skeleton replaced by "$200.00" in mono 28px bold. Green preview card slides up (translateY 8->0). Button goes full opacity, text "Send $200.00". | `activeStepIndex >= 2`, +20 frame delay |
| Step 3 (DONE) | Button bg changes from accent (#FF6E00) to green (#10B981), text changes to "✓ Sent", slight scale(1.02). | `activeStepIndex >= 3`, +15 frame delay |

### Key visual details

- Recipient avatar: 36x36 circle, `#10B981` bg, white "M" centered
- Amount text: `font-mono, 28px, bold, #374151`
- Preview card: bg `#F0FDF4`, border `1.5px solid #BBF7D0`, padding 20px
- Preview text: "Send to Maria" left, "$200.00" right (mono bold), "Date: Today · Fee: $0.00" below
- Submit button: h52, r10, accent bg, white text 18px semibold

---

## 2. CRM: `<Salesforce API>` -> `<HandoffForm>`

**File**: `components/wireframes/CRMWireframe.tsx`
**Component label**: Changes from `<Salesforce API>` to `<HandoffForm>` at step 2
**Concept**: Two-phase display. First shows a dark terminal with API call logs, then transitions to a light handoff form.

### Phase 1: Terminal API view (steps 0-1)

```
+----------------------------------+
|  <Salesforce API>                |   (component label)
|  [●][●][●]  (traffic lights)    |   (terminal header bar, #1F2937)
|                                  |   (terminal body, #111827)
|  GET /opportunities?name=Walmart |   (blue "GET", grey path)
|    → 200 { name: "Walmart Q4" } |   (green response)
|                                  |
|  PATCH /opportunities/opp_47x    |   (yellow "PATCH")
|    { stage: "Closed Won" }       |   (grey body)
|    → 200 OK                      |   (green response)
|                                  |
|  POST /notifications             |   (green "POST", appears step 2)
|    { team: "implementation" }    |
|    → 200 { sent: true }          |
+----------------------------------+
```

### Phase 2: Handoff form (steps 2-3)

When `notifyVisible > 0.6`, the entire container transitions: bg changes from `#111827` to white, terminal header disappears, component label changes to `<HandoffForm>`.

```
+----------------------------------+
|  <HandoffForm>                   |
|                                  |
|  Implementation Handoff          |   (22px semibold)
|                                  |
|  DEAL                            |
|  [Walmart Q4 — $2.4M________]   |   (h48, #F9FAFB bg)
|                                  |
|  CONTACT                         |
|  [Sarah Chen, VP Operations__]   |
|                                  |
|  NOTES                           |
|  [Standard enterprise, 3yr__]    |
+----------------------------------+
```

### Animation sequence

| Step | What happens | Trigger |
|---|---|---|
| Step 0 (PILLAR) | Dark terminal container fades in (0.3 -> 1.0). Traffic light dots visible. Terminal body empty. | `activeStepIndex >= 0`, +15 frame delay |
| Step 1 (YOUR APP - find/update) | GET line appears with spring. After 0.7 progress, green response. PATCH line + body. After 0.9 progress, "→ 200 OK". | `activeStepIndex >= 1`, +20 frame delay |
| Step 2 (YOUR APP - notify) | POST line appears. At 0.6 progress, whole container transitions to white form view. Form fields spring in with pre-filled values. | `activeStepIndex >= 2`, +20 frame delay |
| Step 3 (DONE) | Form field borders turn green (#10B981). | `activeStepIndex >= 3`, +15 frame delay |

### Key visual details

- Terminal header: h40, bg `#1F2937`, 3 dots (10x10 circles: `#EF4444`, `#F59E0B`, `#10B981`)
- HTTP methods: mono 17px bold — GET=`#3B82F6`, PATCH=`#F59E0B`, POST=`#10B981`
- Paths: mono 17px, `#9CA3AF`
- Responses: mono 15px, `#10B981`, indented 20px
- Form fields: h48, r8, border `#E5E7EB`, bg `#F9FAFB`, labels uppercase 13px

---

## 3. Analytics: `<Dashboard>`

**File**: `components/wireframes/AnalyticsWireframe.tsx`
**Component label**: `<Dashboard>`
**Concept**: 2x2 grid of chart widgets appearing one by one.

### Layout

```
+----------------------------------+
|  <Dashboard>                     |
|                                  |
|  User Engagement                 |   (title, 20px semibold)
|                                  |
|  ┌──────────┐ ┌──────────┐      |
|  │ DAU      │ │ Session  │      |   (chart 1: line, chart 2: bar)
|  │  ~~~~~   │ │ ▐▐ ▐▐▐▐  │      |
|  └──────────┘ └──────────┘      |
|  ┌──────────┐ ┌──────────┐      |
|  │ Retention│ │ Signups  │      |   (chart 3: area, chart 4: number)
|  │  /\/\    │ │  1,247   │      |
|  └──────────┘ └──────────┘      |
+----------------------------------+
```

### Chart widget spec

Each chart card: r12, `1.5px` border, padding 18px, full height within grid cell.

| Chart | Title | Type | Color | Position |
|---|---|---|---|---|
| 1 | Daily Active Users | line | `#3B82F6` | top-left |
| 2 | Session Duration | bar | `#8B5CF6` | top-right |
| 3 | Retention | area | `#10B981` | bottom-left |
| 4 | Weekly Signups | number ("1,247") | `#FF6E00` | bottom-right |

- Line chart: SVG polyline, 8 data points: [35, 55, 40, 70, 50, 65, 80, 55], stroke 3px
- Bar chart: 8 bars using same heights, flex layout, r4, 0.7 opacity
- Area chart: SVG polygon (filled at 20% opacity) + polyline overlay (stroke 2.5px)
- Number: mono 36px bold, centered
- Each card header: title (sans 15px semibold) + "7d" badge (mono 12px, textLight)

### Animation sequence

| Step | What happens | Trigger |
|---|---|---|
| Step 0 (PILLAR) | Container fades in. Dashboard title shows "New Dashboard". All 4 chart cards at 0.15 opacity (grey skeletons). | `activeStepIndex >= 0`, +15 frame delay |
| Step 1 (YOUR APP - create charts) | Title changes to "User Engagement". Charts 1 and 2 spring to full opacity with accent glow border. Charts 3-4 remain dim. | `activeStepIndex >= 1`, +20 frame delay. Chart 1 at 0.3 progress, Chart 2 at 0.6 progress |
| Step 2 (YOUR APP - assemble) | Charts 3 and 4 spring to full opacity with accent glow. Charts 1-2 glow fades (border returns to default). | `activeStepIndex >= 2`, +20 frame delay. Chart 3 at 0.3 progress, Chart 4 at 0.6 progress |
| Step 3 (DONE) | All chart glows fade to neutral borders. Settled state. | `activeStepIndex >= 3`, +15 frame delay |

### Key visual details

- Grid: `grid-template-columns: 1fr 1fr`, gap 14px, height 340px (can increase to ~450px for square format)
- "New" glow: `box-shadow: 0 0 20px ${color}25`, border changes to chart color
- Title transition: "New Dashboard" -> "User Engagement" at chartsCreated > 0.5

---

## 4. PM: `<SprintBoard>`

**File**: `components/wireframes/PMWireframe.tsx`
**Component label**: `<SprintBoard>`
**Concept**: 3-column kanban board. A new bug card appears in the Sprint column.

### Layout

```
+---------------------------------------------+
|  <SprintBoard>                               |
|                                              |
|  BACKLOG      | IN PROGRESS  | SPRINT 24     |
|  ┌────────┐   | ┌────────┐   | ┌────────┐   |
|  │Task    │   | │Feature │   | │Bug  P2 │   |
|  │Update  │   | │Dashbrd │   | │Payment │   |
|  │errors  │   | └────────┘   | └────────┘   |
|  └────────┘   |              | ┌────────┐   |
|  ┌────────┐   |              | │Bug  P1 │   |  <- new card
|  │Task    │   |              | │Checkout│   |
|  │Refactor│   |              | │crash   │   |
|  └────────┘   |              | └────────┘   |
+---------------------------------------------+
```

### Kanban card spec

Each card: r10, `1.5px` border, padding 14px. Type badge (mono 12px, r5, colored bg) + optional priority badge. Title: sans 15px semibold.

| Card | Column | Type | Priority | Pre-existing? |
|---|---|---|---|---|
| "Update error messages" | Backlog | Task (grey) | - | Yes, 0.4 opacity |
| "Refactor auth flow" | Backlog | Task (grey) | - | Yes, 0.4 opacity |
| "Dashboard redesign" | In Progress | Feature (grey) | - | Yes, 0.4 opacity |
| "Fix payment gateway" | Sprint 24 | Bug (red) | P2 (yellow) | Yes, 0.4 opacity |
| "Checkout crash" | Sprint 24 | Bug (red) | P1 (red) | **NEW** - appears at step 1 |

### Animation sequence

| Step | What happens | Trigger |
|---|---|---|
| Step 0 (PILLAR) | Container fades in (0.3 -> 1.0). Pre-existing cards visible at 0.4 opacity. Sprint 24 column header in default color. | `activeStepIndex >= 0`, +15 frame delay |
| Step 1 (YOUR APP - create issue) | New "Checkout crash" card appears in Sprint 24 column below existing card. Springs in with opacity 0->1. Bug + P1 badges. | `activeStepIndex >= 1`, +20 frame delay, visible at 0.3 progress |
| Step 2 (YOUR APP - add to sprint) | Sprint 24 column header turns accent orange + dot indicator (●). New card slides up (translateY 8->0). | `activeStepIndex >= 2`, +20 frame delay |
| Step 3 (DONE) | New card gets accent border glow (`0 4px 20px accent25`). | `activeStepIndex >= 3`, `isNew` flag triggers at 0.3 progress |

### Key visual details

- Columns: `flex: 1`, gap 16px, min-height 380px
- Column headers: sans 13px semibold, uppercase, `#9CA3AF`, letter-spacing 0.06em
- Type badges: Bug = `#EF4444` text on `#FEF2F2` bg; Task/Feature = `#6B7280` text on `#F3F4F6` bg
- Priority badges: P1 = `#EF4444`, P2 = `#F59E0B`, same pattern with `${color}15` bg
- Container bg: `#F8FAFC` (slightly different from others)

---

## 5. HR: `<PayrollSettings>`

**File**: `components/wireframes/HRWireframe.tsx`
**Component label**: `<PayrollSettings>`
**Concept**: Settings accordion. Direct Deposit section expands and fields get highlighted.

### Layout

```
+----------------------------------+
|  <PayrollSettings>               |
|                                  |
|  [  Tax Information          ▼]  |   (collapsed, 0.5 opacity)
|                                  |
|  [  Direct Deposit           ▲]  |   (expands at step 1)
|  ├─────────────────────────────┤ |
|  │ Bank of America ••••4821    │ |   (read-only view, step 1)
|  │                       Edit  │ |
|  ├─────────────────────────────┤ |
|  │ ROUTING NUMBER              │ |   (edit mode, step 2)
|  │ [Enter 9-digit routing #___]│ |   <- highlighted with pulse
|  │ ACCOUNT NUMBER              │ |
|  │ [Enter account number______]│ |   <- highlighted with pulse
|  │ ACCOUNT TYPE                │ |
|  │ [Checking__________________]│ |   (not highlighted)
|  │ [ Save Changes ]           │ |
|  └─────────────────────────────┘ |
|                                  |
|  [  Pay Schedule             ▼]  |   (collapsed, 0.5 opacity)
+----------------------------------+
```

### Animation sequence

| Step | What happens | Trigger |
|---|---|---|
| Step 0 (PILLAR) | Container fades in (0.3 -> 1.0). Three accordion sections visible. Tax Info and Pay Schedule at 0.5 opacity, collapsed. Direct Deposit collapsed, default border. | `activeStepIndex >= 0`, +15 frame delay |
| Step 1 (YOUR APP - navigate) | Direct Deposit border turns accent. Arrow rotates 180deg. Section expands to show read-only: "Bank of America ••••4821" with "Edit" link. Light accent bg tint on header. | `activeStepIndex >= 1`, +20 frame delay |
| Step 2 (YOUR APP - open edit) | Read-only view replaced by 3 editable fields. Routing Number and Account Number get accent borders + pulsing glow. Account Type gets default border. "Save Changes" button appears. | `activeStepIndex >= 2`, +20 frame delay |
| Step 3 (DONE) | Button full opacity. Glow stabilizes (stops pulsing). | `activeStepIndex >= 3`, +15 frame delay |

### Key visual details

- Accordion sections: h52, r10, `1.5px` border, flex between label and arrow
- Collapsed sections (Tax Info, Pay Schedule): 0.5 opacity
- Arrow: "▼" character, rotates via `transform: rotate(180deg)` when expanded
- Active header: light accent bg (`${accent}08`)
- Highlight glow: `box-shadow: 0 0 ${10 + sin(time * PI * 3) * 4}px ${accent}25` — pulsing at ~3Hz
- Highlighted field border: `2px solid accent`, bg `${accent}08`
- Non-highlighted field: `2px solid #E5E7EB`, bg `#F9FAFB`
- Fields: h48, r8
- Save button: h48, r8, accent bg, white text 16px semibold

---

## Rendering

After implementing/modifying the wireframes, render with:

```bash
# Individual
npm run wireframes:banking
npm run wireframes:crm
npm run wireframes:analytics
npm run wireframes:pm
npm run wireframes:hr

# All at once
npm run wireframes:all
```

Output files go to `public/marketing/{Name}Wireframe.mp4`.

Preview in Remotion Studio:

```bash
npm run videos:studio
```

Then select the `wireframe-banking` (etc.) composition from the sidebar.
