import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const indexPath = resolve("..", "api-zod", "src", "index.ts");

writeFileSync(indexPath, 'export * from "./generated/api";\n');
