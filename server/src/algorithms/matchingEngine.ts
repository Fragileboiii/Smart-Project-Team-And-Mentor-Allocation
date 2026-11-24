/**
 * Mentor Matching Engine
 *
 * Deterministic weighted compatibility scoring.
 * Weights are configurable; the UI explains each component.
 *
 * Score = w1 * skillOverlap + w2 * domainMatch + w3 * capacityFactor
 *   skillOverlap  = |mentor_skills ∩ team_skills| / |mentor_skills ∪ team_skills|  (Jaccard)
 *   domainMatch   = 1 if mentor expertise matches team project domain, else 0
 *   capacityFactor = remaining_capacity / max_capacity
 */

export interface MatchWeights {
  skillOverlap: number;   // default 0.5
  domainMatch: number;    // default 0.3
  capacityFactor: number; // default 0.2
}

const DEFAULT_WEIGHTS: MatchWeights = {
  skillOverlap: 0.5,
  domainMatch: 0.3,
  capacityFactor: 0.2,
};

export interface MentorMatchResult {
  mentorId: string;
  score: number;           // 0..1
  breakdown: {
    skillOverlap: number;
    domainMatch: number;
    capacityFactor: number;
    matchedSkills: string[];
  };
  available: boolean;
}

const ALIAS_GROUPS: string[][] = [
  ['ml', 'machine learning', 'ai', 'artificial intelligence', 'deep learning'],
  ['os', 'dbms', 'operating systems', 'database', 'systems', 'os/dbms'],
  ['web', 'web development', 'frontend', 'backend', 'fullstack', 'full-stack'],
  ['cloud', 'devops', 'cloud computing', 'cloud/devops', 'kubernetes', 'docker'],
  ['security', 'cybersecurity', 'network security', 'cyber security', 'cryptography'],
  ['mobile', 'mobile computing', 'mobile development', 'android', 'ios', 'flutter', 'react native'],
  ['blockchain', 'blockchain/web3', 'web3', 'crypto', 'smart contracts'],
  ['data engineering', 'big data', 'data pipelines', 'data warehousing'],
];

function domainMatchesEntry(domainStr: string, entry: string): boolean {
  const d = domainStr.toLowerCase().trim();
  const e = entry.toLowerCase().trim();
  if (d === e) return true;
  // If entry is multi-word (e.g. "machine learning"), check phrase inclusion
  if (e.includes(' ') && d.includes(e)) return true;
  if (d.includes(' ') && e.includes(d)) return true;
  // Check exact token match
  const tokens = d.split(/[\s\/\-_,]+/).filter(Boolean);
  return tokens.includes(e);
}

export function areDomainsCompatible(domainA?: string, domainB?: string): boolean {
  if (!domainA || !domainB) return false;
  const a = domainA.trim().toLowerCase();
  const b = domainB.trim().toLowerCase();
  if (a === b) return true;

  // Direct word token overlap (e.g. "Security" in "Cybersecurity" or shared meaningful tokens)
  const tokensA = a.split(/[\s\/\-_,]+/).filter(t => t.length > 2);
  const tokensB = b.split(/[\s\/\-_,]+/).filter(t => t.length > 2);
  if (tokensA.some(t => tokensB.includes(t))) return true;

  // Check alias groups
  for (const group of ALIAS_GROUPS) {
    const aInGroup = group.some(entry => domainMatchesEntry(a, entry));
    const bInGroup = group.some(entry => domainMatchesEntry(b, entry));
    if (aInGroup && bInGroup) return true;
  }

  return false;
}

export function scoreMentor(
  mentorSkills: string[],
  mentorDomains: string[],
  maxCapacity: number,
  remainingCapacity: number,
  teamSkills: string[],
  teamDomain: string,
  mentorPrimaryDomain?: string,
  weights: MatchWeights = DEFAULT_WEIGHTS
): MentorMatchResult['breakdown'] & { score: number } {
  // Jaccard similarity for skills
  const mSet = new Set(mentorSkills.map(s => s.toLowerCase()));
  const tSet = new Set(teamSkills.map(s => s.toLowerCase()));
  const intersection = [...mSet].filter(s => tSet.has(s));
  const union = new Set([...mSet, ...tSet]);
  const skillOverlap = union.size === 0 ? 0 : intersection.length / union.size;

  // Domain match — check primary domain or listed domains/categories
  const primaryMatch = mentorPrimaryDomain ? areDomainsCompatible(mentorPrimaryDomain, teamDomain) : false;
  const secondaryMatch = mentorDomains.some(d =>
    areDomainsCompatible(d, teamDomain) ||
    teamDomain.toLowerCase().includes(d.toLowerCase()) ||
    d.toLowerCase().includes(teamDomain.toLowerCase())
  );
  const domainMatch = (primaryMatch || secondaryMatch) ? 1 : 0;

  // Capacity factor
  const capacityFactor = maxCapacity === 0 ? 0 : remainingCapacity / maxCapacity;

  const score =
    weights.skillOverlap * skillOverlap +
    weights.domainMatch * domainMatch +
    weights.capacityFactor * capacityFactor;

  return {
    score: Math.min(1, Math.max(0, score)),
    skillOverlap,
    domainMatch,
    capacityFactor,
    matchedSkills: intersection,
  };
}
