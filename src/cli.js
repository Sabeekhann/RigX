import { runAgents } from './commands/agents.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runPrivacy } from './commands/privacy.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';

const HELP = `RIGX — local-first harness engineering for coding agents\n\nUsage:\n  rigx init [path] [--force]\n  rigx doctor [path] [--json]\n  rigx agents [--json] [--show-paths]\n  rigx privacy [path] [--json]\n  rigx snapshot [path] [--json]\n  rigx status [path] [--json]\n  rigx --help\n  rigx --version\n\nPrivacy:\n  Strict mode is the default. Core commands make no network requests.\n`;

function positional(args, fallback = '.') {
  return args.find((arg) => !arg.startsWith('-')) ?? fallback;
}

export async function runCli(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write('0.1.0-alpha.1\n');
    return 0;
  }

  const [command, ...args] = argv;
  try {
    let output;
    switch (command) {
      case 'init': output = await runInit(positional(args), args.includes('--force')); break;
      case 'doctor': output = await runDoctor(positional(args), args.includes('--json')); break;
      case 'agents': output = await runAgents(!args.includes('--show-paths'), args.includes('--json')); break;
      case 'privacy': output = await runPrivacy(positional(args), args.includes('--json')); break;
      case 'snapshot': output = await runSnapshot(positional(args), args.includes('--json')); break;
      case 'status': output = await runStatus(positional(args), args.includes('--json')); break;
      default:
        process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
        return 2;
    }
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`RIGX error: ${message}\n`);
    return 1;
  }
}
