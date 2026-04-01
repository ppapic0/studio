import { parseTimeToMinutes } from '@/features/schedules/lib/scheduleModel';

export function buildNoShowFlag(params: {
  now: Date;
  dateKey: string;
  selectedDateKey: string;
  arrivalPlannedAt?: string | null;
  actualArrivalAt?: Date | null;
  status?: string | null;
  graceMinutes?: number;
}) {
  const {
    now,
    dateKey,
    selectedDateKey,
    arrivalPlannedAt,
    actualArrivalAt,
    status,
    graceMinutes = 15,
  } = params;

  if (dateKey !== selectedDateKey) return false;
  if (!arrivalPlannedAt || actualArrivalAt) return false;
  if (status === 'absent' || status === 'checked_out') return false;

  const arrivalMinutes = parseTimeToMinutes(arrivalPlannedAt);
  if (arrivalMinutes === null) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > arrivalMinutes + graceMinutes;
}
