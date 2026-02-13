import { RandomFn } from './random.util';

export function shuffle<T>(input: readonly T[], random: RandomFn): T[] {
  const array = [...input];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}
