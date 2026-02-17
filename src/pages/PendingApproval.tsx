import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary via-royal-dark to-primary pattern-islamic">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-gold">
        <span className="font-arabic text-4xl text-primary-foreground">﷽</span>
      </div>

      <Card className="w-full max-w-md shadow-elevated border-gold/20">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Inscription en attente
          </h1>
          <p className="text-muted-foreground">
            Votre inscription a bien été enregistrée. L'enseignant doit valider votre demande avant que vous puissiez accéder à l'application.
          </p>
          <p className="text-sm text-muted-foreground">
            بارك الله فيك — Qu'Allah vous bénisse pour votre patience.
          </p>
          <Button
            variant="outline"
            onClick={signOut}
            className="mt-4"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
