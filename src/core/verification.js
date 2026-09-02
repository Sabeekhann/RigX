const VERIFICATION_COMMAND_PATTERNS = [
  /\bnpm\s+test\b/,
  /\bnpm\s+run\s+(test|lint|build|check|typecheck)\b/,
  /\byarn\s+(test|lint|build|check|typecheck)\b/,
  /\bpnpm\s+(run\s+)?(test|lint|build|check|typecheck)\b/,
  /\bpytest\b/,
  /\bgo\s+(test|vet|build)\b/,
  /\bcargo\s+(test|check|clippy|build)\b/,
  /\bmvn\s+test\b/,
  /\bgradle\w*\s+(test|check|build)\b/,
  /\bjest\b/,
  /\bvitest\b/,
  /\beslint\b/,
  /\btsc\b/,
  /\bmake\s+(test|check|build)\b/,
  /\brspec\b/,
  /\bruff\b/,
  /\bphpunit\b/,
];

/**
 * Classifies a raw shell command as a verification command without retaining
 * the command text itself. Callers must discard the input after calling this.
 */
export function isVerificationCommand(command) {
  if (typeof command !== 'string' || !command.trim()) return false;
  return VERIFICATION_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}
