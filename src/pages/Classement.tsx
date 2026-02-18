import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trophy, Medal, Star, Crown } from 'lucide-react';
import { useEffect } from 'react';

interface RankingEntry {
  user_id: string;
  total_points: number;
  full_name: string | null;
  rank: number;
}

const getTrophyDisplay = (rank: number) => {
  switch (rank) {
    case 1:
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-lg">
          <Trophy className="h-7 w-7 text-yellow-900" />
        </div>
      );
    case 2:
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 shadow-md">
          <Trophy className="h-5 w-5 text-gray-700" />
        </div>
      );
    case 3:
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 shadow-md">
          <Trophy className="h-4 w-4 text-amber-200" />
        </div>
      );
    case 4:
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-yellow-200 to-yellow-500 shadow-sm">
          <span className="text-sm font-bold text-yellow-900">1</span>
        </div>
      );
    case 5:
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 shadow-sm">
          <span className="text-sm font-bold text-gray-700">2</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 shadow-sm">
          <span className="text-sm font-bold text-amber-100">3</span>
        </div>
      );
  }
};

const getEncouragementMessage = (rank: number, total: number) => {
  if (rank <= 3) {
    return { text: 'Bravo Champion(ne) ! Continue de briller ! 🌟', color: 'text-yellow-600 dark:text-yellow-400' };
  }
  if (rank <= Math.ceil(total / 2)) {
    return { text: 'Tu y es presque ! Encore un petit effort pour le podium ! 💪', color: 'text-primary' };
  }
  return { text: 'Ne lâche rien ! Chaque petit pas compte, tu vas y arriver ! ✨', color: 'text-muted-foreground' };
};

const Classement = () => {
  const { user } = useAuth();

  const { data: rankings, isLoading, refetch } = useQuery({
    queryKey: ['student-rankings'],
    queryFn: async () => {
      // Get all rankings
      const { data: rankingData, error } = await supabase
        .from('student_ranking')
        .select('user_id, total_points')
        .order('total_points', { ascending: false });

      if (error) throw error;

      // Get profiles for names
      const userIds = (rankingData || []).map(r => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      // Assign ranks with tie handling
      const entries: RankingEntry[] = [];
      let currentRank = 1;

      for (let i = 0; i < (rankingData || []).length; i++) {
        const item = rankingData![i];
        // If same points as previous, same rank
        if (i > 0 && item.total_points === rankingData![i - 1].total_points) {
          // Same rank as previous
        } else {
          currentRank = i + 1;
        }

        entries.push({
          user_id: item.user_id,
          total_points: item.total_points,
          full_name: profiles?.find(p => p.user_id === item.user_id)?.full_name || null,
          rank: currentRank,
        });
      }

      return entries;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('rankings-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_ranking',
      }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const myRanking = rankings?.find(r => r.user_id === user?.id);
  const encouragement = myRanking
    ? getEncouragementMessage(myRanking.rank, rankings?.length || 0)
    : null;

  return (
    <AppLayout>
      <div className="px-4 py-6 pb-24 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-7 w-7 text-secondary" />
            <h1 className="text-2xl font-bold text-foreground">Classement</h1>
            <Crown className="h-7 w-7 text-secondary" />
          </div>
          <p className="text-sm text-muted-foreground">Qui sera au sommet cette semaine ?</p>
        </div>

        {/* My position highlight */}
        {myRanking && (
          <Card className="border-secondary/40 bg-gradient-to-r from-secondary/10 to-secondary/5">
            <CardContent className="p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                {getTrophyDisplay(myRanking.rank)}
                <div>
                  <p className="font-bold text-foreground text-lg">
                    {myRanking.rank === 1 ? '1er' : `${myRanking.rank}ème`}
                  </p>
                  <p className="text-sm text-muted-foreground">{myRanking.total_points} points</p>
                </div>
              </div>
              {encouragement && (
                <p className={`text-sm font-medium ${encouragement.color} animate-fade-in`}>
                  {encouragement.text}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rankings?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-3 text-secondary/50" />
            <p>Aucun classement pour le moment</p>
            <p className="text-xs mt-1">Les points seront attribués à chaque validation !</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rankings?.map((entry, index) => {
              const isMe = entry.user_id === user?.id;
              return (
                <Card
                  key={entry.user_id}
                  className={`transition-all duration-300 animate-fade-in ${
                    isMe
                      ? 'border-secondary/50 bg-secondary/5 ring-1 ring-secondary/30'
                      : entry.rank <= 3
                        ? 'border-secondary/20'
                        : ''
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Trophy/Medal */}
                    <div className="flex-shrink-0">
                      {getTrophyDisplay(entry.rank)}
                    </div>

                    {/* Name & rank */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                        {entry.full_name || 'Élève'}
                        {isMe && <span className="text-xs text-muted-foreground ml-1">(Toi)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rang {entry.rank}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-lg ${
                        entry.rank === 1
                          ? 'text-gradient-gold'
                          : entry.rank <= 3
                            ? 'text-primary'
                            : 'text-foreground'
                      }`}>
                        {entry.total_points}
                      </p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Barème des points :</p>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
              <span>📖 Sourate validée : 10 pts</span>
              <span>🌙 Nourania validée : 15 pts</span>
              <span>🕌 Ramadan complété : 5 pts</span>
              <span>🔤 Lettre validée : 5 pts</span>
              <span>🤲 Invocation mémorisée : 5 pts</span>
              <span>🙏 Prière validée : 10 pts</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Classement;
