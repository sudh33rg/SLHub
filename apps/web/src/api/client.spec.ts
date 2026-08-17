import { describe, expect, it } from 'vitest';
import { fmtGb, initial } from './client';

describe('web formatting helpers', () => {
  it('formats GB and TB consistently', () => {
    expect(fmtGb(12.34)).toBe('12.3 GB');
    expect(fmtGb(2048)).toBe('2.00 TB');
  });

  it('returns a safe avatar initial', () => {
    expect(initial(' sudheer')).toBe('S');
    expect(initial()).toBe('?');
  });
});
