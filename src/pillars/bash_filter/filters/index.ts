import type { Filter } from "../engine.js";
import { gitStatus, gitLog, gitDiff } from "./git.js";
import { npmLs } from "./npm.js";
import { tsc } from "./tsc.js";
import { jestVitest } from "./test_runners.js";
import { eslint } from "./eslint.js";
import { dockerPs } from "./docker.js";
import { lsLong, findCmd } from "./coreutils.js";

export const FILTERS: Filter[] = [gitStatus, gitLog, gitDiff, npmLs, tsc, jestVitest, eslint, dockerPs, lsLong, findCmd];
