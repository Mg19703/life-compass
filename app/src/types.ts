// ISO date string: YYYY-MM-DD (local calendar date, no timezone offset)
type ISODate = string;

export interface UserProfile {
  name: string;
  role: string;
  bio: string;
}

export interface AnnualOKR {
  id: string;
  dimensionId: string;
  objective: string;
  year: number;
}

export interface QuarterlyObjective {
  id: string;
  annualOKRId: string;
  objective: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
}

export interface MonthlyKeyResult {
  id: string;
  quarterlyObjectiveId: string;
  keyResult: string;
  month: number; // 1–12
  year: number;
}

export interface WeeklyInitiative {
  id: string;
  monthlyKRId: string;
  text: string;
  weekStart: ISODate; // always a Monday
  completed: boolean;
}

// status is the sole completion signal — no completed: boolean on DailyMIT
export type MITStatus = 'complete' | 'carried' | 'dropped' | 'pending';

export interface DailyMIT {
  id: string;
  date: ISODate;
  text: string;
  status: MITStatus;
  carriedOverFrom: ISODate | null;
  carriedForwardTo: ISODate | null;
  initiativeId: string | null;
}

export interface Exercise {
  type: string;
  durationMinutes: number;
}

export interface DailyLog {
  date: ISODate;
  mood: 1 | 2 | 3 | 4 | 5;
  note: string;
  exercise: Exercise | null;
}

// Six fixed life dimensions — not user-editable
export type DimensionId =
  | 'inner-life'
  | 'relationships'
  | 'health'
  | 'financial-security'
  | 'service'
  | 'learning-growth';

export interface LifeDimension {
  id: DimensionId;
  label: string;
  description: string;
  weightPercent: number;
}

export interface AppState {
  schemaVersion: number;
  profile: UserProfile | null;
  deathbedGoals: string[]; // always length 7; empty slots are ''
  annualOKRs: AnnualOKR[];
  quarterlyObjectives: QuarterlyObjective[];
  monthlyKRs: MonthlyKeyResult[];
  weeklyInitiatives: WeeklyInitiative[];
  dailyMITs: DailyMIT[]; // flat array, queried by .date field
  dailyLogs: Record<ISODate, DailyLog>; // keyed by YYYY-MM-DD
  apiKey: string | null;
}
