import { PillarProvider } from '@pillar-ai/react';

export function App() {
  return (
    <PillarProvider productKey="your-product-key" publicKey="pk_...">
      {/* Your app */}
    </PillarProvider>
  );
}
