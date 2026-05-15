// ISO date string: YYYY-MM-DD (local calendar date, no timezone offset)
type ISODate = string;

// Five application tabs
export type TabId = 'setup' | 'today' | 'plan' | 'coach' | 'review' | 'habits';

// Props shared by all tab components
export interface TabProps {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
}

// Review→Plan deep-link payload (STORY-024 / Risk Register)
export interface PlanNavTarget {
  dimensionId: DimensionId;
  quarterlyObjectiveId: string;
}

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

// v2: Habits (recurring daily behaviors, separate from MITs and OKRs)
export interface Habit {
  id: string;
  name: string;           // user-defined label, max 80 chars
  dimensionId: DimensionId;
  createdAt: ISODate;     // YYYY-MM-DD when habit was created
  archivedAt: ISODate | null; // null = active; date string = archived
}

// v2: Daily check-in log for a single habit on a single date
export interface HabitLog {
  id: string;
  habitId: string;
  date: ISODate;          // YYYY-MM-DD
  completed: boolean;
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
  // v2 additions
  habits: Habit[];        // all habits (active and archived); archivedAt===null means active
  habitLogs: HabitLog[];  // flat array, queried by .habitId and .date
}
