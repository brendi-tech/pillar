import { useHelpPanel } from '@pillar-ai/react';

function HelpButton() {
  const { open, close, toggle, isOpen } = useHelpPanel();

  return (
    <button onClick={toggle}>
      {isOpen ? 'Close Help' : 'Open Help'}
    </button>
  );
}
