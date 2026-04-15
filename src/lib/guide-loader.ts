import fs from "node:fs";
import path from "node:path";

import { parseFauxGuide } from "@/lib/route-parser";
import { LeagueGuide } from "@/lib/types";

let cachedGuide: LeagueGuide | null = null;

export function loadFauxGuide(): LeagueGuide {
  if (cachedGuide) {
    return cachedGuide;
  }

  const filePath = path.join(process.cwd(), "src", "data", "raw-faux-guide.txt");
  const raw = fs.readFileSync(filePath, "utf8");
  cachedGuide = parseFauxGuide(raw);
  return cachedGuide;
}
