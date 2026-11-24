import { describe, it, expect } from 'vitest';
import { areDomainsCompatible, scoreMentor } from '../algorithms/matchingEngine';

describe('Matching Engine — Domain Compatibility & Scoring', () => {
  it('correctly matches identical domains', () => {
    expect(areDomainsCompatible('Machine Learning', 'Machine Learning')).toBe(true);
    expect(areDomainsCompatible('OS/DBMS', 'OS/DBMS')).toBe(true);
    expect(areDomainsCompatible('Cybersecurity', 'Cybersecurity')).toBe(true);
  });

  it('correctly matches alias domains (e.g. ML vs Machine Learning, AI vs ML)', () => {
    expect(areDomainsCompatible('ML', 'Machine Learning')).toBe(true);
    expect(areDomainsCompatible('AI', 'Machine Learning')).toBe(true);
    expect(areDomainsCompatible('OS/DBMS', 'Systems')).toBe(true);
    expect(areDomainsCompatible('Cloud/DevOps', 'Cloud Computing')).toBe(true);
    expect(areDomainsCompatible('Blockchain/Web3', 'Blockchain')).toBe(true);
  });

  it('rejects mismatched domains', () => {
    expect(areDomainsCompatible('Cybersecurity', 'Web Development')).toBe(false);
    expect(areDomainsCompatible('Machine Learning', 'Blockchain/Web3')).toBe(false);
    expect(areDomainsCompatible('OS/DBMS', 'Mobile Computing')).toBe(false);
  });

  it('gives higher score to mentors with matching domain', () => {
    const match = scoreMentor(
      ['Python', 'MySQL'],
      ['AI/ML'],
      3,
      2,
      ['Python', 'MySQL'],
      'Machine Learning',
      'Machine Learning'
    );

    const mismatch = scoreMentor(
      ['Python', 'MySQL'],
      ['AI/ML'],
      3,
      2,
      ['Python', 'MySQL'],
      'Cybersecurity',
      'Machine Learning'
    );

    expect(match.domainMatch).toBe(1);
    expect(mismatch.domainMatch).toBe(0);
    expect(match.score).toBeGreaterThan(mismatch.score);
  });
});
