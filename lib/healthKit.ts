// App-facing API for Apple HealthKit — reading steps, heart rate, sleep,
// weight, distance, and workouts (including GPS routes recorded on Apple
// Watch) so they can be synced up to the backend's /api/health endpoints.
//
// Always reach for these helpers — never import the HealthKit package
// directly elsewhere. On non-iOS platforms every call resolves to a safe
// empty/false result so screens don't have to repeat Platform.OS checks.

import { Platform } from 'react-native';
import type { QuantityTypeIdentifier } from '@kingstinct/react-native-healthkit';
import { health, type HealthMetricType, type HealthRoutePoint, type HealthWorkoutType } from './api';

function isIOS(): boolean {
  return Platform.OS === 'ios';
}

// Loaded lazily (and cached) instead of at module top-level: the native
// Nitro module only exists once the app has been rebuilt with the pod
// linked (`pod install` + a fresh `expo run:ios`/Xcode build). A static
// top-level import throws immediately on any binary that predates that
// rebuild and takes down every screen that transitively imports this file —
// this way it degrades to "HealthKit unavailable" instead of a hard crash.
// Typed `any` deliberately: this is a boundary to a native module we can't
// statically guarantee is linked, so callers already handle absence.
let cachedModule: any | null | undefined;
let cachedWorkoutActivityType: any = null;

function loadModule(): any | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@kingstinct/react-native-healthkit');
    cachedModule = mod.default ?? mod;
    cachedWorkoutActivityType = mod.WorkoutActivityType;
  } catch (e) {
    console.warn('[healthKit] native module not available (needs a rebuild after pod install):', e);
    cachedModule = null;
  }
  return cachedModule;
}

// ── Identifier maps ──────────────────────────────────────────────────────────
// Keep these in one place so the backend's HealthMetricType/HealthWorkoutType
// enums (lib/api.ts) and HealthKit's own identifiers never drift apart.
const QUANTITY_METRICS: Record<
  Exclude<HealthMetricType, 'sleepHours' | 'heartRateAvg'>,
  { identifier: QuantityTypeIdentifier; unit: string; stat: 'cumulativeSum' | 'discreteAverage' }
> = {
  steps:                   { identifier: 'HKQuantityTypeIdentifierStepCount',              unit: 'count', stat: 'cumulativeSum' },
  activeEnergyBurned:      { identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned',      unit: 'kcal',  stat: 'cumulativeSum' },
  restingHeartRate:        { identifier: 'HKQuantityTypeIdentifierRestingHeartRate',        unit: 'count/min', stat: 'discreteAverage' },
  heartRateVariability:    { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', unit: 'ms',   stat: 'discreteAverage' },
  bodyMass:                { identifier: 'HKQuantityTypeIdentifierBodyMass',                unit: 'kg',    stat: 'discreteAverage' },
  distanceWalkingRunning:  { identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning',  unit: 'km',    stat: 'cumulativeSum' },
  flightsClimbed:          { identifier: 'HKQuantityTypeIdentifierFlightsClimbed',          unit: 'count', stat: 'cumulativeSum' },
  // HealthKit stores O2 saturation as a fraction (0–1) in the '%' unit; we
  // convert to 0–100 below before syncing.
  oxygenSaturation:        { identifier: 'HKQuantityTypeIdentifierOxygenSaturation',        unit: '%',     stat: 'discreteAverage' },
};
// heartRateAvg is derived from the raw (non-resting) heart rate stream, same identifier family but averaged.
const HEART_RATE_AVG_IDENTIFIER: QuantityTypeIdentifier = 'HKQuantityTypeIdentifierHeartRate';

function workoutTypeMap(): Partial<Record<number, HealthWorkoutType>> {
  const WorkoutActivityType = cachedWorkoutActivityType;
  if (!WorkoutActivityType) return {};
  return {
    [WorkoutActivityType.running]: 'running',
    [WorkoutActivityType.walking]: 'walking',
    [WorkoutActivityType.cycling]: 'cycling',
    [WorkoutActivityType.swimming]: 'swimming',
    [WorkoutActivityType.hiking]: 'hiking',
    [WorkoutActivityType.functionalStrengthTraining]: 'functionalStrengthTraining',
    [WorkoutActivityType.traditionalStrengthTraining]: 'traditionalStrengthTraining',
    [WorkoutActivityType.yoga]: 'yoga',
    [WorkoutActivityType.coreTraining]: 'coreTraining',
  };
}

// Format a Date as YYYY-MM-DD in the device's LOCAL timezone. Using
// toISOString() here would format in UTC, which shifts the calendar day for
// anyone ahead of/behind UTC (e.g. IST is UTC+5:30) — today's HealthKit data
// would land on yesterday's date row and the dashboard's /scores?date=<local
// today> query would find nothing. Mirrors lib/api.ts's toDateStr.
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const healthKit = {
  async isAvailable(): Promise<boolean> {
    if (!isIOS()) return false;
    const mod = loadModule();
    if (!mod) return false;
    try {
      return await mod.isHealthDataAvailableAsync();
    } catch {
      return false;
    }
  },

  /** Prompts the system permission sheet for everything GRITTT reads. Safe to call repeatedly. */
  async requestAuthorization(): Promise<boolean> {
    if (!isIOS()) return false;
    const mod = loadModule();
    if (!mod) return false;
    try {
      return await mod.requestAuthorization({
        toRead: [
          ...Object.values(QUANTITY_METRICS).map(m => m.identifier),
          HEART_RATE_AVG_IDENTIFIER,
          'HKCategoryTypeIdentifierSleepAnalysis',
          'HKWorkoutTypeIdentifier',
        ],
      });
    } catch {
      return false;
    }
  },

  /** Daily aggregates (sum for steps/energy/distance/flights, average for heart rate/weight) over [from, to]. */
  async getDailyMetrics(from: Date, to: Date): Promise<Array<{
    date: string; metricType: HealthMetricType; value: number; unit: string;
  }>> {
    if (!isIOS()) return [];
    const mod = loadModule();
    if (!mod) return [];
    const out: Array<{ date: string; metricType: HealthMetricType; value: number; unit: string }> = [];

    for (const [metricType, cfg] of Object.entries(QUANTITY_METRICS) as Array<
      [Exclude<HealthMetricType, 'sleepHours' | 'heartRateAvg'>, typeof QUANTITY_METRICS[keyof typeof QUANTITY_METRICS]]
    >) {
      try {
        const days = await mod.queryStatisticsCollectionForQuantity(
          cfg.identifier,
          [cfg.stat],
          from,
          { day: 1 },
          { filter: { date: { startDate: from, endDate: to } }, unit: cfg.unit as any },
        );
        for (const day of days) {
          const q = cfg.stat === 'cumulativeSum' ? day.sumQuantity : day.averageQuantity;
          if (q == null || !day.startDate) continue;
          // O2 saturation comes back as a 0–1 fraction in '%' unit — normalize to 0–100.
          const value = metricType === 'oxygenSaturation' && q.quantity <= 1 ? q.quantity * 100 : q.quantity;
          const unit  = metricType === 'oxygenSaturation' ? '%' : q.unit;
          out.push({ date: toDateStr(day.startDate), metricType, value, unit });
        }
      } catch (e) {
        console.warn(`[healthKit] failed reading ${metricType}:`, e);
      }
    }

    // Heart rate average — same shape, separate identifier from resting HR.
    try {
      const days = await mod.queryStatisticsCollectionForQuantity(
        HEART_RATE_AVG_IDENTIFIER,
        ['discreteAverage'],
        from,
        { day: 1 },
        { filter: { date: { startDate: from, endDate: to } }, unit: 'count/min' as any },
      );
      for (const day of days) {
        if (day.averageQuantity == null || !day.startDate) continue;
        out.push({ date: toDateStr(day.startDate), metricType: 'heartRateAvg', value: day.averageQuantity.quantity, unit: day.averageQuantity.unit });
      }
    } catch (e) {
      console.warn('[healthKit] failed reading heartRateAvg:', e);
    }

    // Sleep — summed "asleep" category-sample durations, bucketed by the day the sleep *ended* on
    // (so a night that starts at 11pm and ends 7am counts toward the morning's date).
    try {
      const samples = await mod.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        filter: { date: { startDate: from, endDate: to } },
        limit: 0,
      });
      // In this HealthKit binding, a sleep sample's `value` is the NUMERIC
      // HKCategoryValueSleepAnalysis enum, not a string:
      //   inBed=0 · asleepUnspecified/asleep=1 · awake=2 · asleepCore=3 ·
      //   asleepDeep=4 · asleepREM=5
      // Bucket each stage by the day the sleep *ended* on. "Total asleep" =
      // deep + rem + light (excludes inBed and awake). String forms kept as a
      // fallback in case a future binding returns the raw HK strings.
      const stageOf = (v: number | string): 'deep' | 'rem' | 'light' | 'awake' | null => {
        if (v === 4 || v === 'HKCategoryValueSleepAnalysisAsleepDeep') return 'deep';
        if (v === 5 || v === 'HKCategoryValueSleepAnalysisAsleepREM') return 'rem';
        if (v === 3 || v === 1 ||
            v === 'HKCategoryValueSleepAnalysisAsleepCore' ||
            v === 'HKCategoryValueSleepAnalysisAsleepUnspecified' ||
            v === 'HKCategoryValueSleepAnalysisAsleep') return 'light';
        if (v === 2 || v === 'HKCategoryValueSleepAnalysisAwake') return 'awake';
        return null; // inBed / unknown — ignore
      };
      type StageMap = { deep: number; rem: number; light: number; awake: number };
      const byDate = new Map<string, StageMap>();
      for (const s of samples as any[]) {
        const stage = stageOf(s.value);
        if (!stage) continue;
        const hrs = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 3_600_000;
        const key = toDateStr(new Date(s.endDate));
        const m = byDate.get(key) ?? { deep: 0, rem: 0, light: 0, awake: 0 };
        m[stage] += hrs;
        byDate.set(key, m);
      }
      const r1 = (n: number) => Math.round(n * 10) / 10;
      for (const [date, m] of byDate) {
        const asleep = m.deep + m.rem + m.light;
        if (asleep > 0) out.push({ date, metricType: 'sleepHours', value: r1(asleep), unit: 'hours' });
        if (m.deep > 0)  out.push({ date, metricType: 'sleepDeep',  value: r1(m.deep),  unit: 'hours' });
        if (m.rem > 0)   out.push({ date, metricType: 'sleepRem',   value: r1(m.rem),   unit: 'hours' });
        if (m.light > 0) out.push({ date, metricType: 'sleepLight', value: r1(m.light), unit: 'hours' });
        if (m.awake > 0) out.push({ date, metricType: 'sleepAwake', value: r1(m.awake), unit: 'hours' });
      }
    } catch (e) {
      console.warn('[healthKit] failed reading sleepHours:', e);
    }

    return out;
  },

  /** Completed workouts in [from, to], including GPS routes where HealthKit has one (e.g. an Apple Watch run). */
  async getWorkouts(from: Date, to: Date): Promise<Array<{
    externalId: string; workoutType: HealthWorkoutType; startTime: string; endTime: string;
    durationSeconds: number; distanceMeters?: number; calories?: number; route?: HealthRoutePoint[];
  }>> {
    if (!isIOS()) return [];
    const mod = loadModule();
    if (!mod) return [];
    try {
      const workouts = await mod.queryWorkoutSamples({
        filter: { date: { startDate: from, endDate: to } },
        limit: 0,
      });

      const results: Array<{
        externalId: string; workoutType: HealthWorkoutType; startTime: string; endTime: string;
        durationSeconds: number; distanceMeters?: number; calories?: number; route?: HealthRoutePoint[];
      }> = [];

      const typeMap = workoutTypeMap();
      for (const w of workouts) {
        const workoutType = typeMap[w.workoutActivityType] ?? 'other';
        const durationSeconds = w.duration.unit === 'min' ? w.duration.quantity * 60 : w.duration.quantity;

        let route: HealthRoutePoint[] | undefined;
        try {
          const routes = await w.getWorkoutRoutes();
          if (routes.length > 0) {
            route = routes.flatMap((r: any) =>
              r.locations.map((loc: any) => ({
                lat: loc.latitude, lng: loc.longitude,
                timestamp: new Date(loc.date).toISOString(),
                altitude: loc.altitude,
              }))
            );
          }
        } catch {
          // No route available for this workout (e.g. an indoor session) — fine, just omit it.
        }

        results.push({
          externalId: w.uuid,
          workoutType,
          startTime: w.startDate.toISOString(),
          endTime: w.endDate.toISOString(),
          durationSeconds: Math.round(durationSeconds),
          distanceMeters: w.totalDistance?.quantity,
          calories: w.totalEnergyBurned?.quantity,
          route,
        });
      }
      return results;
    } catch (e) {
      console.warn('[healthKit] failed reading workouts:', e);
      return [];
    }
  },

  /** Pulls the last `days` of metrics + workouts and pushes them to the backend. */
  async syncToBackend(token: string, days = 30): Promise<{ metricsSynced: number; workoutsSynced: number }> {
    if (!isIOS()) return { metricsSynced: 0, workoutsSynced: 0 };

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    // Anchor the daily statistics buckets to LOCAL midnight so each bucket is a
    // calendar day (HKStatisticsCollectionQuery aligns intervals to the anchor's
    // time-of-day — without this the buckets would run from "now" to "now" and
    // split today's data across two dates).
    from.setHours(0, 0, 0, 0);

    const [metrics, workouts] = await Promise.all([
      healthKit.getDailyMetrics(from, to),
      healthKit.getWorkouts(from, to),
    ]);

    let metricsSynced = 0;
    let workoutsSynced = 0;

    if (metrics.length > 0) {
      const payload = metrics.map(m => ({ ...m, source: 'healthkit' as const }));
      try {
        const res = await health.syncMetrics(token, payload);
        metricsSynced = res.synced;
      } catch (e) {
        // An older server build may not recognize newer metric types and reject
        // the WHOLE batch. Retry without those so steps/sleep/HR still sync
        // until the server is updated.
        const NEWER = new Set(['oxygenSaturation', 'sleepDeep', 'sleepRem', 'sleepLight', 'sleepAwake']);
        const known = payload.filter(m => !NEWER.has(m.metricType));
        if (known.length && known.length < payload.length) {
          const res = await health.syncMetrics(token, known);
          metricsSynced = res.synced;
        } else {
          throw e;
        }
      }
    }
    if (workouts.length > 0) {
      const res = await health.syncWorkouts(token, workouts.map(w => ({ ...w, source: 'healthkit' as const })));
      workoutsSynced = res.synced;
    }

    return { metricsSynced, workoutsSynced };
  },
};
