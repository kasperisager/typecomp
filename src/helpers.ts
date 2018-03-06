import * as tsconfig from "tsconfig";
import * as path from "path";

export function getRoot(filename: string): string | null {
  const config = tsconfig.findSync(filename);

  if (config) {
    return path.dirname(config);
  }

  return null;
}
