import type { AppState, LifeDimension } from './types';

export const SCHEMA_VERSION = 2;

export const LIFE_DIMENSIONS: LifeDimension[] = [
  {
    id: 'inner-life',
    label: 'Inner Life',
    description: 'Meditation, self-inquiry, integrity, peace',
    weightPercent: 20,
  },
  {
    id: 'relationships',
    label: 'Relationships',
    description: 'Atieh, Noor, family, deep friendships',
    weightPercent: 20,
  },
  {
    id: 'health',
    label: 'Health',
    description: 'Physical practice, sleep, nutrition, energy',
    weightPercent: 15,
  },
  {
    id: 'financial-security',
    label: 'Financial Security',
    description: 'Income, savings, investments, studio vehicle',
    weightPercent: 20,
  },
  {
    id: 'service',
    label: 'Service',
    description: 'Volunteering, helping, contributing to the world',
    weightPercent: 15,
  },
  {
    id: 'learning-growth',
    label: 'Learning & Growth',
    description: 'MBA, contemplative study, feeds everything above',
    weightPercent: 10,
  },
];

export const DEFAULT_APP_STATE: AppState = {
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  deathbedGoals: ['', '', '', '', '', '', ''],
  annualOKRs: [],
  quarterlyObjectives: [],
  monthlyKRs: [],
  weeklyInitiatives: [],
  dailyMITs: [],
  dailyLogs: {},
  apiKey: null,
  habits: [],
  habitLogs: [],
};
