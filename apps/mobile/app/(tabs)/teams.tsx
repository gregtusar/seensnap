import { PlaceholderCard } from "@/components/placeholder-card";
import { Screen } from "@/components/screen";

export default function TeamsScreen() {
  return (
    <Screen
      title="Teams"
      subtitle="Invite link and invite code flows only, with no chat in Phase 1."
    >
      <PlaceholderCard
        eyebrow="Watch Teams"
        title="Small-group discovery"
        body="Users will create teams, join with a code, and see team activity driven by ratings, watchlist actions, and shares."
      />
    </Screen>
  );
}

