// Prayer time calculation based on sun position
// This is a simplified implementation based on ISNA (Islamic Society of North America) calculation method

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface PrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

// Calculation settings - ISNA method (Fajr: 15°, Isha: 15°)
const FAJR_ANGLE = 15;
const ISHA_ANGLE = 15;
const ASR_FACTOR = 1; // Standard (Shafi'i, Maliki, Hanbali)

// Convert degrees to radians
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

// Convert radians to degrees
const toDegrees = (radians: number): number => radians * (180 / Math.PI);

// Calculate Julian Day
const julianDay = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
};

// Calculate sun declination
const sunDeclination = (jd: number): number => {
  const d = jd - 2451545.0;
  const g = 357.529 + 0.98560028 * d;
  const q = 280.459 + 0.98564736 * d;
  const L = q + 1.915 * Math.sin(toRadians(g)) + 0.020 * Math.sin(toRadians(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const decl = toDegrees(Math.asin(Math.sin(toRadians(e)) * Math.sin(toRadians(L))));
  return decl;
};

// Calculate equation of time
const equationOfTime = (jd: number): number => {
  const d = jd - 2451545.0;
  const g = 357.529 + 0.98560028 * d;
  const q = 280.459 + 0.98564736 * d;
  const L = q + 1.915 * Math.sin(toRadians(g)) + 0.020 * Math.sin(toRadians(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const RA = toDegrees(Math.atan2(Math.cos(toRadians(e)) * Math.sin(toRadians(L)), Math.cos(toRadians(L)))) / 15;
  const eqt = q / 15 - RA;
  return eqt;
};

// Calculate mid-day time
const midDay = (jd: number, timezone: number, longitude: number): number => {
  const eqt = equationOfTime(jd);
  return 12 + timezone - longitude / 15 - eqt;
};

// Calculate sun angle time
const sunAngleTime = (jd: number, angle: number, latitude: number, timezone: number, longitude: number, direction: 'rise' | 'set'): number => {
  const decl = sunDeclination(jd);
  const noon = midDay(jd, timezone, longitude);
  
  const cosHourAngle = (
    -Math.sin(toRadians(angle)) - Math.sin(toRadians(latitude)) * Math.sin(toRadians(decl))
  ) / (Math.cos(toRadians(latitude)) * Math.cos(toRadians(decl)));
  
  if (cosHourAngle > 1 || cosHourAngle < -1) {
    return NaN; // Sun doesn't reach this angle
  }
  
  const hourAngle = toDegrees(Math.acos(cosHourAngle)) / 15;
  return direction === 'rise' ? noon - hourAngle : noon + hourAngle;
};

// Calculate Asr time
const asrTime = (jd: number, factor: number, latitude: number, timezone: number, longitude: number): number => {
  const decl = sunDeclination(jd);
  const noon = midDay(jd, timezone, longitude);
  
  const angle = -toDegrees(Math.atan(1 / (factor + Math.tan(toRadians(Math.abs(latitude - decl))))));
  
  const cosHourAngle = (
    -Math.sin(toRadians(angle)) - Math.sin(toRadians(latitude)) * Math.sin(toRadians(decl))
  ) / (Math.cos(toRadians(latitude)) * Math.cos(toRadians(decl)));
  
  const hourAngle = toDegrees(Math.acos(cosHourAngle)) / 15;
  return noon + hourAngle;
};

// Convert decimal hours to Date
const hoursToDate = (hours: number, date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  result.setHours(h, m, 0, 0);
  return result;
};

// Get timezone offset in hours
const getTimezone = (): number => {
  return -new Date().getTimezoneOffset() / 60;
};

// Calculate all prayer times for a given date and location
export const calculatePrayerTimes = (date: Date, coords: Coordinates): PrayerTimes => {
  const jd = julianDay(date);
  const timezone = getTimezone();
  const { latitude, longitude } = coords;
  
  const noon = midDay(jd, timezone, longitude);
  
  // Calculate each prayer time
  const fajrTime = sunAngleTime(jd, FAJR_ANGLE, latitude, timezone, longitude, 'rise');
  const sunriseTime = sunAngleTime(jd, 0.833, latitude, timezone, longitude, 'rise'); // 0.833° for atmospheric refraction
  const dhuhrTime = noon + 1/60; // Add 1 minute after solar noon
  const asrTimeCalc = asrTime(jd, ASR_FACTOR, latitude, timezone, longitude);
  const maghribTime = sunAngleTime(jd, 0.833, latitude, timezone, longitude, 'set');
  const ishaTime = sunAngleTime(jd, ISHA_ANGLE, latitude, timezone, longitude, 'set');
  
  return {
    fajr: hoursToDate(fajrTime, date),
    sunrise: hoursToDate(sunriseTime, date),
    dhuhr: hoursToDate(dhuhrTime, date),
    asr: hoursToDate(asrTimeCalc, date),
    maghrib: hoursToDate(maghribTime, date),
    isha: hoursToDate(ishaTime, date),
  };
};

// Get user's location
export const getUserLocation = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Default to Paris if geolocation not available
      resolve({ latitude: 48.8566, longitude: 2.3522 });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Default to Paris on error
        resolve({ latitude: 48.8566, longitude: 2.3522 });
      },
      { timeout: 10000 }
    );
  });
};

// Format time for display
export const formatPrayerTime = (date: Date): string => {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get next prayer
export const getNextPrayer = (prayerTimes: PrayerTimes): { name: string; time: Date } | null => {
  const now = new Date();
  const prayers = [
    { name: 'Fajr', time: prayerTimes.fajr },
    { name: 'Dhuhr', time: prayerTimes.dhuhr },
    { name: 'Asr', time: prayerTimes.asr },
    { name: 'Maghrib', time: prayerTimes.maghrib },
    { name: 'Isha', time: prayerTimes.isha },
  ];
  
  for (const prayer of prayers) {
    if (prayer.time > now) {
      return prayer;
    }
  }
  
  // If all prayers have passed, return Fajr of next day
  const tomorrowFajr = new Date(prayerTimes.fajr);
  tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
  return { name: 'Fajr', time: tomorrowFajr };
};

// Calculate time until next prayer
export const getTimeUntilPrayer = (prayerTime: Date): string => {
  const now = new Date();
  const diff = prayerTime.getTime() - now.getTime();
  
  if (diff < 0) return '—';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
};
