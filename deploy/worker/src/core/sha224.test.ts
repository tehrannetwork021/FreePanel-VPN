import { describe, expect, it } from 'vitest';
import { sha224Hex } from './sha224';

describe('SHA-224', () => {
  it.each([
    ['', 'd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f'],
    ['abc', '23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7'],
  ])('matches the standard vector for %j', (input, expected) => {
    expect(sha224Hex(input)).toBe(expected);
  });
});
