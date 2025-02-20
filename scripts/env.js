import { fileURLToPath } from "url";
import { dirname } from "path";

// Get the current file's URL
export const __filename = fileURLToPath(import.meta.url);

// Get the current directory
export const __dirname = dirname(__filename);
