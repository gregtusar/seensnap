import { PlaceholderCard } from "@/components/placeholder-card";
import { Screen } from "@/components/screen";

export default function SettingsScreen() {
  return (
    <Screen
      title="Settings"
      subtitle="Preferences will cover notifications, connected services, and share defaults."
    >
      <PlaceholderCard
        eyebrow="Preferences"
        title="US-first configuration"
        body="This screen will manage notification permissions, connected streaming services, and the Instagram-first share defaults from the PRD."
      />
    </Screen>
  );
}
