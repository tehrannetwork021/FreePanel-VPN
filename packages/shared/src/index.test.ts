import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from './index';

describe('shared product identity', () => {
  it('exposes only the Tehran Network product name', () => {
    expect(PRODUCT_NAME).toBe('Tehran Network Edge Panel');
  });
});
