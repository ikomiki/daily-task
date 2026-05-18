import base from '@org/config-vitest/react';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(base, {
  test: {},
});
