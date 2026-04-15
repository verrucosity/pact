import LeagueCompanion from "@/app/league-companion";
import { loadFauxGuide } from "@/lib/guide-loader";

export default function Home() {
  const guide = loadFauxGuide();
  return <LeagueCompanion guide={guide} />;
}
