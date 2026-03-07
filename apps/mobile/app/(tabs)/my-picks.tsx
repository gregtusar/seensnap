import { PlaceholderCard } from "@/components/placeholder-card";
import { Screen } from "@/components/screen";

export default function MyPicksScreen() {
  return (
    <Screen
      title="My Picks"
      subtitle="Every user gets a default watchlist in Phase 1."
    >
      <PlaceholderCard
        eyebrow="Watchlist"
        title="Saved titles and ratings"
        body="This section will hold the default watchlist, user ratings, and quick access to anything saved from the snip result flow."
      />
    </Screen>
  );
}

