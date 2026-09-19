import { describe, expect, it } from 'vitest';
import { en } from './dictionaries/en';
import { fa } from './dictionaries/fa';
import { createTranslator, getDirection } from './index';

describe('translation parity', () => {
  it('keeps Persian and English keys identical', () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });

  it('uses rtl for Persian and ltr for English', () => {
    expect(getDirection('fa')).toBe('rtl');
    expect(getDirection('en')).toBe('ltr');
  });

  it('contains no empty Persian strings', () => {
    expect(Object.values(fa).every((value) => value.trim().length > 0)).toBe(true);
  });

  it('translates the same semantic key in both locales', () => {
    expect(createTranslator('en')('nav.overview')).toBe('Overview');
    expect(createTranslator('fa')('nav.overview')).toBe('نمای کلی');
  });
});
