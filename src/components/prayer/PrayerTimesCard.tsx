import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Loader2 } from 'lucide-react';
import { usePrayerTimes } from '@/hooks/usePrayerTimes';
import { cn } from '@/lib/utils';

const PrayerTimesCard = () => {
  const { prayerTimes, nextPrayer, loading, error, location } = usePrayerTimes();

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    );
  }

  const prayers = [
    { name: 'Fajr', time: prayerTimes?.fajr, arabic: 'الفجر' },
    { name: 'Sunrise', time: prayerTimes?.sunrise, arabic: 'الشروق' },
    { name: 'Dhuhr', time: prayerTimes?.dhuhr, arabic: 'الظهر' },
    { name: 'Asr', time: prayerTimes?.asr, arabic: 'العصر' },
    { name: 'Maghrib', time: prayerTimes?.maghrib, arabic: 'المغرب' },
    { name: 'Isha', time: prayerTimes?.isha, arabic: 'العشاء' },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary to-royal-dark text-primary-foreground pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>Horaires de prière</span>
          </div>
          {location && (
            <div className="flex items-center gap-1 text-xs opacity-70">
              <MapPin className="h-3 w-3" />
              <span>Votre position</span>
            </div>
          )}
        </CardTitle>
        
        {/* Next prayer highlight */}
        {nextPrayer && (
          <div className="mt-3 p-3 rounded-xl bg-gold/20 border border-gold/30">
            <p className="text-sm opacity-80">Prochaine prière</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold">{nextPrayer.name}</span>
              <div className="text-right">
                <span className="text-lg font-semibold">{nextPrayer.timeFormatted}</span>
                <p className="text-xs opacity-70">dans {nextPrayer.timeUntil}</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {prayers.map((prayer) => (
            <div
              key={prayer.name}
              className={cn(
                'flex items-center justify-between px-4 py-3 transition-colors',
                nextPrayer?.name === prayer.name && 'bg-gold/10'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    nextPrayer?.name === prayer.name ? 'bg-gold' : 'bg-muted'
                  )}
                />
                <div>
                  <p className="font-medium text-foreground">{prayer.name}</p>
                  <p className="text-xs text-muted-foreground font-arabic">{prayer.arabic}</p>
                </div>
              </div>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  nextPrayer?.name === prayer.name ? 'text-gold' : 'text-foreground'
                )}
              >
                {prayer.time}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PrayerTimesCard;
