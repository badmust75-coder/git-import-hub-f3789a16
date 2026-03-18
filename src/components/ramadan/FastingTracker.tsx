import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

const FastingTracker = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [joursJeunes, setJoursJeunes] = useState<number[]>([]);

  const { data: fastingData = [] } = useQuery({
    queryKey: ['ramadan-fasting', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_ramadan_fasting')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    setJoursJeunes(fastingData.filter(f => f.has_fasted).map(f => f.day_number));
  }, [fastingData]);

  const handleClickJour = async (dayNumber: number) => {
    if (!user?.id) return;
    const dejaJeune = joursJeunes.includes(dayNumber);

    if (dejaJeune) {
      // Optimistic remove
      setJoursJeunes(prev => prev.filter(d => d !== dayNumber));
      const existing = fastingData.find(f => f.day_number === dayNumber);
      if (existing) {
        const { error } = await supabase
          .from('user_ramadan_fasting')
          .update({ has_fasted: false } as any)
          .eq('id', existing.id);
        if (error) {
          toast.error('Erreur: ' + error.message);
          setJoursJeunes(prev => [...prev, dayNumber]);
        }
      }
    } else {
      // Optimistic add
      setJoursJeunes(prev => [...prev, dayNumber]);

      const existing = fastingData.find(f => f.day_number === dayNumber);
      if (existing) {
        const { error } = await supabase
          .from('user_ramadan_fasting')
          .update({ has_fasted: true } as any)
          .eq('id', existing.id);
        if (error) {
          toast.error('Erreur: ' + error.message);
          setJoursJeunes(prev => prev.filter(d => d !== dayNumber));
          return;
        }
      } else {
        const { error } = await (supabase as any)
          .from('user_ramadan_fasting')
          .insert({
            user_id: user.id,
            day_number: dayNumber,
            has_fasted: true,
            date: new Date().toISOString().split('T')[0],
          });
        if (error) {
          toast.error('Erreur: ' + error.message);
          setJoursJeunes(prev => prev.filter(d => d !== dayNumber));
          return;
        }
      }

      // Confettis
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#22c55e', '#3b82f6', '#f97316'],
        zIndex: 9999,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['ramadan-fasting'] });
  };

  const fastedCount = joursJeunes.length;

  return (
    <div className="module-card rounded-2xl p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Suivi du Jeûne 🌙</span>
        <span className="text-xs text-muted-foreground">{fastedCount}/30 jours jeûnés</span>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
          const jeune = joursJeunes.includes(day);
          return (
            <button
              key={day}
              onClick={() => handleClickJour(day)}
              className="relative flex flex-col items-center justify-center w-full aspect-square transition-all active:scale-90"
              title={`Jour ${day} - ${jeune ? 'Jeûné ✓' : 'Cliquer pour marquer'}`}
            >
              <Star
                className="w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200"
                style={{
                  fill: jeune ? '#f59e0b' : 'none',
                  stroke: jeune ? '#f59e0b' : '#d1d5db',
                  strokeWidth: 2,
                }}
              />
              <span
                className="text-[9px] font-bold"
                style={{ color: jeune ? '#f59e0b' : '#9ca3af' }}
              >
                {day}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 justify-center text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3" style={{ fill: '#f59e0b', stroke: '#f59e0b' }} />
          <span>Jeûné</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3" style={{ fill: 'none', stroke: '#d1d5db' }} />
          <span>À marquer</span>
        </div>
      </div>
    </div>
  );
};

export default FastingTracker;
