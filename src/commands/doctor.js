import path from 'node:path';
import { analyzeRepository, inventoryRepository } from '../core/scanner.js';
import { scoreFindings } from '../core/score.js';
import { formatDoctorReport } from '../core/format.js';

export async function runDoctor(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const report = scoreFindings(inventory, findings);
  return json ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorReport(report);
}
