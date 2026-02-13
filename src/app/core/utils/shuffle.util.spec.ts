import { createSeededRandom } from './random.util';
import { shuffle } from './shuffle.util';

describe('shuffle utility', () => {
  it('produces deterministic order with the same seed', () => {
    const source = ['a', 'b', 'c', 'd', 'e'];

    const first = shuffle(source, createSeededRandom('seed-123'));
    const second = shuffle(source, createSeededRandom('seed-123'));

    expect(first).toEqual(second);
  });

  it('does not mutate the original array', () => {
    const source = [1, 2, 3, 4];
    const before = [...source];

    shuffle(source, createSeededRandom('seed-456'));

    expect(source).toEqual(before);
  });

  it('generally produces a different order for a different seed', () => {
    const source = ['x', 'y', 'z', 'w'];

    const first = shuffle(source, createSeededRandom('seed-a')).join(',');
    const second = shuffle(source, createSeededRandom('seed-b')).join(',');

    expect(first).not.toEqual(second);
  });
});
