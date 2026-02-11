# Wireframe primitives

Reusable building blocks for the Remotion wireframe video compositions. All live in `frontend/remotion/videos/components/wireframes/primitives/`.

Import everything from the barrel:

```typescript
import {
  useStepSpring,
  WireframeContainer,
  WireframeField,
  SkeletonBar,
  WireframeButton,
} from "./primitives";
```

---

## `useStepSpring`

Hook that returns a spring function tied to step activation frames. Replaces the identical `stepSpring` lambda that was copy-pasted in every wireframe.

**File:** `useStepSpring.ts`

```typescript
const stepSpring = useStepSpring(stepActivationFrames);
const visible = activeStepIndex >= 0 ? stepSpring(0, 15) : 0;
```

**Parameters:**
- `stepActivationFrames: number[]` — array from `getStepActivationFrames()`

**Returns:** `(stepIdx: number, delay?: number) => number` — call with step index and optional frame delay. Returns a 0-1 spring value.

**Spring config:** `{ damping: 18, stiffness: 100, mass: 0.8 }` (shared across all wireframes).

**Used in:** Banking, CRM, Analytics, PM, HR.

---

## `WireframeContainer`

Full-bleed centering wrapper + dashed-border card + component label. This is the outermost shell of every wireframe.

**File:** `WireframeContainer.tsx`

```tsx
<WireframeContainer label="<PaymentForm>" opacity={skeletonVisible}>
  {/* wireframe content */}
</WireframeContainer>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | JSX-style tag shown above the border, e.g. `"<PaymentForm>"` |
| `opacity` | `number` | required | Spring value (0-1). Interpolated to 0.3-1.0 range. |
| `maxWidth` | `number` | `700` | Max width of the dashed container in px. Works in both 1920x1080 (right column ~1240px) and 1080x1080 (square ~1040px) layouts. |
| `backgroundColor` | `string` | `#FFFFFF` | Container background. |
| `padding` | `number` | `40` | Inner padding in px. |
| `children` | `ReactNode` | required | Content inside the dashed container. |

**Used in:** Banking. Designed for use by all 5 wireframes.

---

## `WireframeField`

Form field: uppercase label above a bordered input-style box. Children go inside the box (text content, avatars, skeletons, etc.).

**File:** `WireframeField.tsx`

```tsx
<WireframeField
  label="Recipient"
  borderColor={payeeFound > 0.5 ? WF.accent : WF.border}
>
  <SkeletonBar width="70%" />
</WireframeField>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | Uppercase label text above the field. |
| `borderColor` | `string` | `#E5E7EB` | Border color. Pass `WF.accent` for highlighted state. |
| `backgroundColor` | `string` | `transparent` | Field background. |
| `height` | `number` | `56` | Field height in px. |
| `borderWidth` | `string` | `"2px"` | Border width. |
| `borderRadius` | `number` | `10` | Corner radius. |
| `paddingX` | `number` | `20` | Horizontal padding inside the field. |
| `gap` | `number` | `14` | Gap between child elements. |
| `marginBottom` | `number` | `28` | Bottom margin. |
| `boxShadow` | `string` | `undefined` | For glow/pulse effects. |
| `labelColor` | `string` | `#9CA3AF` | Label text color. |
| `children` | `ReactNode` | required | Content inside the input box. |

**Used in:** Banking (Recipient, Amount). Applicable to CRM handoff (Deal, Contact, Notes) and HR (Routing Number, Account Number, Account Type).

---

## `SkeletonBar`

Grey placeholder bar for unfilled/loading states.

**File:** `SkeletonBar.tsx`

```tsx
<SkeletonBar width="70%" />
<SkeletonBar width="40%" height={12} />
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | `string` | required | Width, e.g. `"70%"` or `"120px"`. |
| `height` | `number` | `16` | Height in px. |
| `borderRadius` | `number` | `4` | Corner radius. |

**Used in:** Banking (Recipient skeleton, Amount skeleton).

---

## `WireframeButton`

Full-width action button with centered label.

**File:** `WireframeButton.tsx`

```tsx
<WireframeButton
  label={done > 0.5 ? "✓ Sent" : "Send $200.00"}
  backgroundColor={done > 0.5 ? "#10B981" : WF.accent}
  opacity={formFilled > 0.3 ? 1 : 0.3}
  scale={done > 0.5 ? 1.02 : 1}
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | Button text. |
| `backgroundColor` | `string` | `#FF6E00` | Button background color. |
| `opacity` | `number` | `1` | Opacity (0-1). |
| `scale` | `number` | `1` | CSS scale transform value. |
| `height` | `number` | `52` | Button height in px. |
| `fontSize` | `number` | `18` | Label font size. |

**Used in:** Banking (Send/Sent). Applicable to HR (Save Changes).
