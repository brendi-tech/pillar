type BlinkingCursorProps = {
  frame: number;
  startFrame: number;
  visible?: boolean;
};

export const BlinkingCursor = ({
  frame,
  startFrame,
  visible = true,
}: BlinkingCursorProps) => {
  if (!visible) return null;

  // Blink every 15 frames (toggle on/off)
  const cursorVisible = Math.floor((frame - startFrame) / 15) % 2 === 0;

  return (
    <span
      style={{
        display: "inline-block",
        width: 3,
        height: 24,
        backgroundColor: cursorVisible ? "#1A1A1A" : "transparent",
        marginLeft: 2,
        verticalAlign: "text-bottom",
      }}
    />
  );
};
