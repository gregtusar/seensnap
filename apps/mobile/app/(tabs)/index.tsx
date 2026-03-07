import { PlaceholderCard } from "@/components/placeholder-card";
import { Screen } from "@/components/screen";

export default function HomeScreen() {
  return (
    <Screen
      title="SeenSnap"
      subtitle="Home will combine recommendations, recent snips, and watch team activity."
    >
      <PlaceholderCard
        eyebrow="Recommendations"
        title="AI-guided, TMDB-backed suggestions"
        body="Phase 1 will blend favorite genres, prior ratings, watchlist state, and team activity into a practical home feed."
      />
      <PlaceholderCard
        eyebrow="Activity"
        title="Recent signals"
        body="Snips, ratings, watchlist additions, and invite activity will surface here once backend endpoints are connected."
      />
    </Screen>
  );
}

