/**
 * Pillar context injection key
 */

import type { InjectionKey } from 'vue';
import type { PillarContextValue } from './types';

export const pillarContextKey: InjectionKey<PillarContextValue> = Symbol('pillar');
