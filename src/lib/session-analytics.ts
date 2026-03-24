import type { StudySession } from './types';

export interface DaySessionReport {
  dateKey: string;
  totalSessions: number;
  completedSessions: number;
  autoClosedSessions: number;
  completionRate: number; // 0–100
  totalMinutes: number;
  avgDurationMinutes: number;
  longestMinutes: number;
}

export interface WeekSessionTrend {
  dateKey: string;
  totalMinutes: number;
  sessionCount: number;
}

/**
 * Summarises a single day's sessions into a concise report.
 * Sessions with a `closedReason` field are treated as auto-closed.
 */
export function buildDaySessionReport(
  dateKey: string,
  sessions: (StudySession & { closedReason?: string })[],
): DaySessionReport {
  if (sessions.length === 0) {
    return {
      dateKey,
      totalSessions: 0,
      completedSessions: 0,
      autoClosedSessions: 0,
      completionRate: 100,
      totalMinutes: 0,
      avgDurationMinutes: 0,
      longestMinutes: 0,
    };
  }

  const autoClosedCount = sessions.filter((s) => !!s.closedReason).length;
  const completedCount = sessions.length - autoClosedCount;
  const totalMinutes = sessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);

  return {
    dateKey,
    totalSessions: sessions.length,
    completedSessions: completedCount,
    autoClosedSessions: autoClosedCount,
    completionRate: Math.round((completedCount / sessions.length) * 100),
    totalMinutes,
    avgDurationMinutes: Math.round(totalMinutes / sessions.length),
    longestMinutes: Math.max(...sessions.map((s) => s.durationMinutes ?? 0)),
  };
}

/**
 * Converts a list of (dateKey, sessions[]) pairs into a daily trend array
 * suitable for driving a Recharts BarChart or LineChart.
 */
export function buildWeekSessionTrend(
  entries: { dateKey: string; sessions: (StudySession & { closedReason?: string })[] }[],
): WeekSessionTrend[] {
  return entries.map(({ dateKey, sessions }) => ({
    dateKey,
    totalMinutes: sessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0),
    sessionCount: sessions.length,
  }));
}
