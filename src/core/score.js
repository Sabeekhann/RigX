const CATEGORIES = [
  'repository-legibility',
  'instructions',
  'verification',
  'skills',
  'tooling',
  'privacy',
];

export function scoreFindings(inventory, findings) {
  const categoryScores = CATEGORIES.map((category) => {
    const deductions = findings
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + item.deduction, 0);
    return { category, score: Math.max(0, 100 - deductions) };
  });

  const overallScore = Math.round(
    categoryScores.reduce((sum, item) => sum + item.score, 0) / categoryScores.length,
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root: inventory.root,
    overallScore,
    categoryScores,
    inventory,
    findings,
  };
}
