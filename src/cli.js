import { readFileSync } from 'node:fs';
import { runAgents } from './commands/agents.js';
import { runDoctor } from './commands/doctor.js';
import { runEvaluate } from './commands/evaluate.js';
import { runInit } from './commands/init.js';
import { runIndex } from './commands/index.js';
import { runObserve } from './commands/observe.js';
import { runPatterns } from './commands/patterns.js';
import { runPrivacy } from './commands/privacy.js';
import { runPropose } from './commands/propose.js';
import { runRecurrence } from './commands/recurrence.js';
import { runSnapshot } from './commands/snapshot.js';
import { runStatus } from './commands/status.js';

const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const HELP = `RIGX — local-first harness engineering for coding agents\n\nUsage:\n  rigx init [path] [--force]\n  rigx doctor [path] [--json]\n  rigx agents [--json] [--show-paths]\n  rigx privacy [path] [--json]\n  rigx observe --agent <claude-code|codex> [--input <file|->] [--json]\n  rigx patterns --agent <claude-code|codex> [--input <file|->] [--json]\n  rigx index [path] --agent <claude-code|codex> [--input <file|->] [--json]\n  rigx recurrence [path] [--json]\n  rigx propose [path] [--json]\n  rigx evaluate [path] --baseline <ref> --candidate <ref> [--json]\n  rigx snapshot [path] [--json]\n  rigx status [path] [--json]\n  rigx --help\n  rigx --version\n\nPrivacy:\n  Strict mode is the default. Core commands make no network requests.\n`;

function positional(args, fallback = '.') {
  return args.find((arg) => !arg.startsWith('-')) ?? fallback;
}

function optionValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function commandPath(args, flagNames = ['--agent', '--input']) {
  const consumed = new Set();
  for (const name of flagNames) {
    const index = args.indexOf(name);
    if (index >= 0) consumed.add(index + 1);
  }
  return args.find((arg, index) => !arg.startsWith('-') && !consumed.has(index)) ?? '.';
}

export async function runCli(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
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
      case 'observe': {
        const agentIndex = args.indexOf('--agent');
        const inputIndex = args.indexOf('--input');
        output = await runObserve({
          agent: agentIndex >= 0 ? args[agentIndex + 1] : undefined,
          input: inputIndex >= 0 ? args[inputIndex + 1] : '-',
          json: args.includes('--json'),
        });
        break;
      }
      case 'patterns': {
        const agentIndex = args.indexOf('--agent');
        const inputIndex = args.indexOf('--input');
        output = await runPatterns({
          agent: agentIndex >= 0 ? args[agentIndex + 1] : undefined,
          input: inputIndex >= 0 ? args[inputIndex + 1] : '-',
          json: args.includes('--json'),
        });
        break;
      }
      case 'index': output = await runIndex({
        root: commandPath(args),
        agent: optionValue(args, '--agent'),
        input: optionValue(args, '--input', '-'),
        json: args.includes('--json'),
      }); break;
      case 'recurrence': output = await runRecurrence(positional(args), args.includes('--json')); break;
      case 'propose': output = await runPropose(positional(args), args.includes('--json')); break;
      case 'evaluate': {
        const baseline = optionValue(args, '--baseline');
        const candidate = optionValue(args, '--candidate');
        if (!baseline || !candidate) throw new Error('evaluate requires --baseline <ref> and --candidate <ref>.');
        output = await runEvaluate(
          commandPath(args, ['--baseline', '--candidate']),
          baseline,
          candidate,
          args.includes('--json'),
        );
        break;
      }
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
