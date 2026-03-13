import { useState, useEffect, useRef } from "react";
import { Mic, Square, Send, CheckCircle, BookOpen, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Devoir = {
  id: string;
  titre: string;
  type: string;
  description?: string;
  lien_lecon?: string;
  date_limite?: string;
  rendu?: boolean;
};

function CarteDevoir({ devoir, onRendu }: { devoir: Devoir; onRendu: (id: string, audioBlob: Blob) => void }) {
  const [enregistrement, setEnregistrement] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setEnregistrement(true);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setEnregistrement(false);
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setSending(true);
    await onRendu(devoir.id, audioBlob);
    setSending(false);
  };

  const emoji: Record<string, string> = {
    sourate: '📖',
    nourania: '🔤',
    recitation: '🎙️',
    exercice_pdf: '📄',
    autre: '✏️'
  };

  return (
    <div className={cn(
      "rounded-2xl p-4 mb-3 shadow-sm border-2",
      devoir.rendu
        ? "border-green-400 bg-green-50 dark:bg-green-950/20 dark:border-green-700"
        : "border-destructive/40 bg-destructive/5"
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji[devoir.type] || '✏️'}</span>
          <div>
            <p className="font-bold text-foreground text-sm">{devoir.titre}</p>
            {devoir.description && (
              <p className="text-xs text-muted-foreground">{devoir.description}</p>
            )}
          </div>
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-full",
          devoir.rendu
            ? "bg-green-500 text-white"
            : "bg-destructive text-destructive-foreground"
        )}>
          {devoir.rendu ? '✅ Rendu' : '⏳ À faire'}
        </span>
      </div>

      {devoir.date_limite && (
        <p className="text-xs text-muted-foreground mb-2">
          📅 Pour le {new Date(devoir.date_limite).toLocaleDateString('fr-FR')}
        </p>
      )}

      {!devoir.rendu && (
        <div className="flex flex-col gap-2">
          {devoir.lien_lecon && (
            <a
              href={devoir.lien_lecon}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground"
            >
              <BookOpen className="w-4 h-4" />
              Voir la leçon
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <div className="flex gap-2">
            {!enregistrement && !audioBlob && (
              <button
                onClick={startRecording}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                <Mic className="w-4 h-4" />
                Enregistrer
              </button>
            )}

            {enregistrement && (
              <button
                onClick={stopRecording}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground animate-pulse"
              >
                <Square className="w-4 h-4" />
                Arrêter
              </button>
            )}

            {audioBlob && !enregistrement && (
              <>
                <audio src={audioUrl!} controls className="flex-1 h-9" />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? '...' : 'Rendre'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {devoir.rendu && (
        <div className="flex items-center gap-2 mt-1">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
            Devoir rendu — en attente de correction
          </p>
        </div>
      )}
    </div>
  );
}

export default function BlocDevoirsEleve() {
  const { user } = useAuth();
  const [devoirs, setDevoirs] = useState<Devoir[]>([]);
  const [devoirsTermines, setDevoirsTermines] = useState<Devoir[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const charger = async () => {
      // Get student's groups
      const { data: groupData } = await supabase
        .from('student_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const gIds = groupData?.map(g => g.group_id) || [];

      // Build OR filter
      let orFilter = `assigned_to.eq.all,student_id.eq.${user.id}`;
      if (gIds.length > 0) {
        orFilter += `,group_id.in.(${gIds.join(',')})`;
      }

      const { data } = await supabase
        .from('devoirs')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false });

      // Check which are already submitted
      const { data: rendus } = await supabase
        .from('devoirs_rendus')
        .select('devoir_id')
        .eq('student_id', user.id);

      const rendusIds = new Set(rendus?.map(r => r.devoir_id) || []);

      const enrichis = (data || []).map(d => ({
        id: d.id,
        titre: d.titre,
        type: d.type,
        description: d.description || undefined,
        lien_lecon: d.lien_lecon || undefined,
        date_limite: d.date_limite || undefined,
        rendu: rendusIds.has(d.id)
      }));

      setDevoirs(enrichis.filter(d => !d.rendu));
      setDevoirsTermines(enrichis.filter(d => d.rendu));
      setLoading(false);
    };

    charger();
  }, [user]);

  const handleRendu = async (devoirId: string, audioBlob: Blob) => {
    if (!user) return;

    const fileName = `${user.id}/${devoirId}-${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('devoirs-audios')
      .upload(fileName, audioBlob);

    if (uploadError) {
      toast.error('Erreur upload: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('devoirs-audios')
      .getPublicUrl(fileName);

    const { error } = await supabase
      .from('devoirs_rendus')
      .insert({
        devoir_id: devoirId,
        student_id: user.id,
        audio_url: urlData.publicUrl,
        statut: 'rendu'
      });

    if (error) {
      toast.error('Erreur: ' + error.message);
      return;
    }

    toast.success('🎉 Devoir rendu avec succès !');
    const rendu = devoirs.find(d => d.id === devoirId);
    setDevoirs(prev => prev.filter(d => d.id !== devoirId));
    if (rendu) setDevoirsTermines(prev => [{ ...rendu, rendu: true }, ...prev]);
  };

  if (loading || (devoirs.length === 0 && devoirsTermines.length === 0)) return null;

  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        📚 Mes devoirs
        {devoirs.length > 0 && (
          <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
            {devoirs.length}
          </span>
        )}
      </h2>

      {devoirs.map(d => (
        <CarteDevoir key={d.id} devoir={d} onRendu={handleRendu} />
      ))}

      {devoirsTermines.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-muted-foreground mb-2">
            ✅ Devoirs terminés ({devoirsTermines.length})
          </p>
          {devoirsTermines.map(d => (
            <CarteDevoir key={d.id} devoir={d} onRendu={handleRendu} />
          ))}
        </div>
      )}
    </div>
  );
}
