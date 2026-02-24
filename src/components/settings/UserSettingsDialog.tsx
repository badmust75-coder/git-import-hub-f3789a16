import { useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const UserSettingsDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Name
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleOpen = () => {
    const currentName = user?.user_metadata?.full_name || '';
    setNewName(currentName);
    setNewPassword('');
    setConfirmPassword('');
    setOpen(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim() || !user) return;
    setSavingName(true);
    try {
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: newName.trim() },
      });
      if (authError) throw authError;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: newName.trim() })
        .eq('user_id', user.id);
      if (profileError) throw profileError;

      toast.success('Nom mis à jour ✓');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du nom');
    } finally {
      setSavingName(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Mot de passe mis à jour ✓');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="text-primary-foreground hover:bg-primary-foreground/10"
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Paramètres du profil</DialogTitle>
            <DialogDescription>Modifier votre nom ou votre mot de passe</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Change name */}
            <div className="space-y-2">
              <Label htmlFor="settings-name" className="font-semibold">Changer le nom</Label>
              <Input
                id="settings-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Votre nom"
              />
              <Button
                onClick={handleSaveName}
                disabled={savingName || !newName.trim()}
                className="w-full"
                size="sm"
              >
                {savingName ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer le nom
              </Button>
            </div>

            {/* Change password */}
            <div className="space-y-2">
              <Label htmlFor="settings-pw" className="font-semibold">Changer le mot de passe</Label>
              <Input
                id="settings-pw"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe (min. 8 car.)"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
              />
              <Button
                onClick={handleSavePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full"
                size="sm"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer le mot de passe
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserSettingsDialog;
