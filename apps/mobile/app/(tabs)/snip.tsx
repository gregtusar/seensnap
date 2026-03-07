import { PlaceholderCard } from "@/components/placeholder-card";
import { Screen } from "@/components/screen";

export default function SnipScreen() {
  return (
    <Screen
      title="Snip"
      subtitle="Manual title search and assisted image match are the agreed MVP recognition flow."
    >
      <PlaceholderCard
        eyebrow="Capture"
        title="Camera and upload flow"
        body="This screen will host the capture UI, upload handoff, and low-confidence fallback into manual title confirmation."
      />
    </Screen>
  );
}

