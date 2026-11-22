// UMBRA HEIST — the hand-in program (Node 22, standard library only).
//
// It hands the playable game in: it copies game/ and screenshots/ from beside
// this file into the output directory and writes dossier.json there, the
// summary the judge reads, built by the vendored make.fun library.
//
//   node main.ts [--out <dir>] [--quiet]
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory comes from --out when given, else MAKEFUN_OUTPUT_DIR,
// else /output (the grader's directory). Before anything is copied the
// program checks the entry against the scorer's caps itself — game file
// count, game bytes, path lengths, screenshot count and size, and that no
// entry of game/ is a symbolic link — so a bad entry fails here with the
// offending path named, instead of halfway through the hand-in. The output
// is deterministic: the same repository hands in the same bytes every run.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps, from the bounty's gate: only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse.
const TEXT_MAX_BYTES = 163840;
const SHOT_MAX = 4;
const SHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;
const DEFAULT_OUT = '/output';

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(
    'Usage: node main.ts [--out <dir>] [--quiet]\n' +
      '  --out <dir>   output directory (default: $MAKEFUN_OUTPUT_DIR or /output)\n' +
      '  --quiet       print nothing on success\n' +
      '  --help        show this text',
  );
}

function parseArgs(argv) {
  const opts = { out: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--quiet') {
      opts.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--out' || arg.startsWith('--out=')) {
      const value = arg === '--out' ? argv[++i] : arg.slice('--out='.length);
      if (value === undefined || value === '') fail('--out needs a directory');
      opts.out = value;
    } else {
      fail(`unknown argument ${JSON.stringify(arg)} (see --help)`);
    }
  }
  return opts;
}

// Walk game/ once, counting files and bytes, and refuse anything the
// scorer would refuse, naming the path. Returns { files, bytes }.
function surveyGame(gameDir) {
  const found = { files: 0, bytes: 0 };
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      fail(`game/${rel}: cannot be read`);
    }
    for (const entry of entries) {
      const path = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (Buffer.byteLength(path, 'utf8') > GAME_PATH_MAX_BYTES) {
        fail(`game/${path}: path is over ${GAME_PATH_MAX_BYTES} bytes`);
      }
      const full = join(dir, entry.name);
      let st;
      try {
        st = lstatSync(full);
      } catch {
        fail(`game/${path}: cannot be read`);
      }
      if (st.isSymbolicLink() || (!st.isFile() && !st.isDirectory())) {
        fail(`game/${path}: a symbolic link or special file (game/ holds plain files and directories only)`);
      }
      found.files += 1;
      if (found.files > GAME_MAX_FILES) {
        fail(`game/: holds more than the ${GAME_MAX_FILES} files and directories allowed`);
      }
      if (st.isDirectory()) {
        walk(full, path);
      } else {
        found.bytes += st.size;
        if (found.bytes > GAME_MAX_BYTES) {
          fail(`game/: its files come to more than the ${GAME_MAX_BYTES} bytes allowed`);
        }
      }
    }
  };
  if (!existsSync(gameDir)) fail('game/: no such directory');
  walk(gameDir, '');
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html: no such file: a game is a directory of static files, its index.html at its root');
  }
  return found;
}

// Check screenshots/ against its caps. A missing directory means no
// screenshots; anything else must be a PNG or JPEG inside the size cap.
// Returns the image names in name order.
function surveyShots(shotsDir) {
  if (!existsSync(shotsDir)) return [];
  let names;
  try {
    names = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  } catch {
    fail('screenshots/: cannot be read');
  }
  if (names.length > SHOT_MAX) {
    fail(`screenshots/: holds ${names.length} images, more than the ${SHOT_MAX} allowed`);
  }
  for (const name of names) {
    if (!/\.(png|jpe?g)$/i.test(name)) fail(`screenshots/${name}: not a PNG or JPEG image`);
    let size;
    try {
      size = statSync(join(shotsDir, name)).size;
    } catch {
      fail(`screenshots/${name}: cannot be read`);
    }
    if (size > SHOT_MAX_BYTES) {
      fail(`screenshots/${name}: ${size} bytes, over the ${SHOT_MAX_BYTES} allowed`);
    }
  }
  return names;
}

function handIn() {
  const opts = parseArgs(process.argv.slice(2));
  const repo = fileURLToPath(new URL('.', import.meta.url));
  const out = resolve(opts.out ?? process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUT);
  const gameDir = join(repo, 'game');
  const shotsDir = join(repo, 'screenshots');

  const game = surveyGame(gameDir);
  const shots = surveyShots(shotsDir);

  mkdirSync(out, { recursive: true });
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (shots.length > 0) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

  const dossier = buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: SHOT_MAX, max_bytes: SHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: GAME_PATH_MAX_BYTES,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);

  if (!opts.quiet) {
    console.log(
      `UMBRA HEIST handed in: ${game.files} game files (${game.bytes} bytes), ` +
        `${shots.length} screenshot${shots.length === 1 ? '' : 's'} ` +
        `(${shots.join(', ') || 'none'}), dossier ${dossier.length} bytes -> ${out}`,
    );
  }
}

handIn();
