import path from 'node:path';

function severityIcon(severity) {
  if (severity === 'error') return '✖';
  if (severity === 'warning') return '▲';
  return '•';
}

function label(value) {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function formatDoctorReport(report) {
  const lines = [];
  lines.push('RIGX Doctor');
  lines.push('────────────────────────────────────────');
  lines.push(`Repository: ${path.basename(report.root)}`);
  lines.push(`Harness health: ${report.overallScore}/100`);
  lines.push('');
  lines.push('Scores');
  for (const category of report.categoryScores) {
    lines.push(`  ${label(category.category).padEnd(24)} ${String(category.score).padStart(3)}/100`);
  }
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('No deterministic harness findings detected.');
    return lines.join('\n');
  }

  lines.push(`Findings (${report.findings.length})`);
  for (const finding of report.findings) {
    lines.push('');
    lines.push(`${severityIcon(finding.severity)} ${finding.title}`);
    for (const evidence of finding.evidence) lines.push(`    evidence: ${evidence}`);
    if (finding.recommendation) lines.push(`    next: ${finding.recommendation}`);
  }
  return lines.join('\n');
}
