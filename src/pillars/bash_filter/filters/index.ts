import type { Filter } from "../engine.js";
import { gitStatus, gitLog, gitDiff } from "./git.js";
import { npmLs } from "./npm.js";
import { tsc } from "./tsc.js";

export const FILTERS: Filter[] = [gitStatus, gitLog, gitDiff, npmLs, tsc];
