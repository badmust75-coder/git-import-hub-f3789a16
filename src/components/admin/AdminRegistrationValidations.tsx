import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, User, ArrowLeft } from 'lucide-react';

interface PendingUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
}

const AdminRegistrationValidations = ({ onBack }: { onBack: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['admin-pending-registrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, gender, age, created_at')
        .eq('is_approved', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as PendingUser[];
    },
  });

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Inscription approuvée ✅',
        description: "L'élève peut maintenant accéder à l'application.",
      });

      queryClient.invalidateQueries({ queryKey: ['admin-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-registrations-count'] });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erreur',
        description: "Impossible d'approuver l'inscription.",
        variant: 'destructive',
      });
    }
    setProcessingId(null);
  };

  const handleReject = async (userId: string) => {
    setProcessingId(userId);
    try {
      // We don't delete the user, just keep is_approved = false
      // Admin can choose to approve later
      toast({
        title: 'Inscription refusée',
        description: "L'élève ne pourra pas accéder à l'application.",
      });
    } catch (err) {
      console.error(err);
    }
    setProcessingId(null);
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour
      </Button>

      <h2 className="text-xl font-bold text-foreground">Validation d'inscription</h2>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-20 bg-muted/50" />
            </Card>
          ))}
        </div>
      ) : pendingUsers && pendingUsers.length > 0 ? (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <Card key={user.user_id} className="border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {user.full_name || 'Sans nom'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {user.gender && (
                          <Badge variant="outline" className="text-xs">
                            {user.gender === 'garcon' ? '👦 Garçon' : '👧 Fille'}
                          </Badge>
                        )}
                        {user.age && (
                          <Badge variant="outline" className="text-xs">
                            {user.age} ans
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(user.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => handleReject(user.user_id)}
                      disabled={processingId === user.user_id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(user.user_id)}
                      disabled={processingId === user.user_id}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
          <CardContent className="p-6 text-center">
            <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-green-700 dark:text-green-300 font-medium">
              Aucune inscription en attente
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminRegistrationValidations;
