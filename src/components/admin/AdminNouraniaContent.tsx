import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDeleteDialog from '@/components/ui/confirm-delete-dialog';
import ContentUploadTabs from './ContentUploadTabs';
import ContentItemCard, { ContentType } from './ContentItemCard';
import AdminCommentaireLecon from './AdminCommentaireLecon';

function NouraniaLessonCard({ lesson, lessonContents, mapContentType, setDeleteContentId, updateTitleMutation, deleteMutation, handleUploadFile, handleAddYoutube, handleUploadAudio, isUploading, profiles }: any) {
  const [targetStudent, setTargetStudent] = useState<string>('');
  return (
    <Card key={lesson.id}>
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-bold">Leçon {lesson.lesson_number}</p>
          <p className="text-sm text-muted-foreground">{lesson.title_french}</p>
        </div>
        <AdminCommentaireLecon leconId={lesson.id} />
        {lessonContents.length > 0 && (
          <div className="space-y-1.5">
            {lessonContents.map((content: any) => {
              const studentName = content.target_user_id
                ? (profiles || []).find((p: any) => p.user_id === content.target_user_id)?.full_name || 'Élève'
                : null;
              return (
                <div key={content.id}>
                  <ContentItemCard
                    id={content.id}
                    title={content.file_name}
                    contentType={mapContentType(content.content_type)}
                    url={content.file_url}
                    onDelete={(id: string) => setDeleteContentId(id)}
                    onUpdateTitle={(id: string, title: string) => updateTitleMutation.mutate({ id, title })}
                    deleteDisabled={deleteMutation.isPending}
                  />
                  {studentName && (
                    <div className="flex items-center gap-2 ml-8 mt-0.5 text-xs">
                      <UserCheck className="h-3 w-3 text-blue-500" />
                      <span className="text-blue-600 font-medium">→ {studentName}</span>
                      {content.viewed_at ? (
                        <span className="flex items-center gap-1 text-green-600"><Eye className="h-3 w-3" />Vu</span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-500"><EyeOff className="h-3 w-3" />Non vu</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {lessonContents.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun contenu</p>}
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
            📩 Destinataire du prochain contenu
          </p>
          <select
            className="w-full p-2 border rounded-lg bg-background text-foreground text-sm"
            value={targetStudent}
            onChange={(e) => setTargetStudent(e.target.value)}
          >
            <option value="">Tous les élèves (global)</option>
            {(profiles || []).map((p: any) => (
              <option key={p.user_id} value={p.user_id}>{p.full_name || p.email || 'Élève'}</option>
            ))}
          </select>
        </div>
        <ContentUploadTabs
          onUploadFile={(file: File) => handleUploadFile(lesson.id, file, targetStudent || undefined)}
          onAddYoutubeLink={(url: string) => handleAddYoutube(lesson.id, url, targetStudent || undefined)}
          onUploadAudio={(file: File) => handleUploadAudio(lesson.id, file, targetStudent || undefined)}
          isUploading={isUploading}
        />
      </CardContent>
    </Card>
  );
}

const AdminNouraniaContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [deleteContentId, setDeleteContentId] = useState<string | null>(null);
  

  const { data: lessons = [] } = useQuery({
    queryKey: ['admin-nourania-lessons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('nourania_lessons').select('*').order('lesson_number');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contents = [], refetch: refetchContents } = useQuery({
    queryKey: ['admin-nourania-contents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('nourania_lesson_content').select('*').order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles-nourania'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const getContentTypeFromFile = (file: File): string => {
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/pdf') return 'fichier';
    return 'fichier';
  };

  const getDefaultTitle = (contentType: string, fileName: string): string => {
    switch (contentType) {
      case 'youtube': return 'Vidéo YouTube';
      case 'audio': return 'Audio';
      default: return fileName;
    }
  };

  const handleUploadFile = useCallback(async (lessonId: string, file: File, targetUserId?: string) => {
    if (!user?.id) { toast.error('Vous devez être connecté'); return; }
    setIsUploading(true);
    try {
      const existingCount = contents.filter(c => c.lesson_id === lessonId).length;
      const ext = file.name.split('.').pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `lesson-${lessonId}/${uniqueName}`;
      const { error: uploadError } = await supabase.storage.from('nourania-content').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) { toast.error(`Erreur upload: ${uploadError.message}`); return; }
      const { data: urlData } = supabase.storage.from('nourania-content').getPublicUrl(filePath);
      const contentType = getContentTypeFromFile(file);
      const insertData: any = {
        lesson_id: lessonId, content_type: contentType, file_url: urlData.publicUrl,
        file_name: getDefaultTitle(contentType, file.name), display_order: existingCount, uploaded_by: user.id,
      };
      if (targetUserId) insertData.target_user_id = targetUserId;
      const { error: insertError } = await supabase.from('nourania_lesson_content').insert(insertData);
      if (insertError) { toast.error(`Erreur: ${insertError.message}`); return; }
      await refetchContents();
      const studentName = targetUserId ? profiles.find((p: any) => p.user_id === targetUserId)?.full_name : null;
      toast.success(studentName ? `Fichier envoyé à ${studentName} ✅` : 'Fichier téléversé ✅');
    } catch (error) { console.error('Upload error:', error); }
    finally { setIsUploading(false); }
  }, [user, contents, profiles, refetchContents]);

  const handleAddYoutube = useCallback(async (lessonId: string, embedUrl: string, targetUserId?: string) => {
    if (!user?.id) return;
    setIsUploading(true);
    try {
      const existingCount = contents.filter(c => c.lesson_id === lessonId).length;
      const insertData: any = {
        lesson_id: lessonId, content_type: 'youtube', file_url: embedUrl,
        file_name: 'Vidéo YouTube', display_order: existingCount, uploaded_by: user.id,
      };
      if (targetUserId) insertData.target_user_id = targetUserId;
      const { error } = await supabase.from('nourania_lesson_content').insert(insertData);
      if (error) { toast.error(error.message); return; }
      await refetchContents();
      const studentName = targetUserId ? profiles.find((p: any) => p.user_id === targetUserId)?.full_name : null;
      toast.success(studentName ? `Lien envoyé à ${studentName} ✅` : 'Lien YouTube ajouté ✅');
    } catch (error) { console.error(error); }
    finally { setIsUploading(false); }
  }, [user, contents, profiles, refetchContents]);

  const handleUploadAudio = useCallback(async (lessonId: string, file: File, targetUserId?: string) => {
    if (!user?.id) { toast.error('Vous devez être connecté'); return; }
    setIsUploading(true);
    try {
      const existingCount = contents.filter(c => c.lesson_id === lessonId).length;
      const ext = file.name.split('.').pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `lesson-${lessonId}/${uniqueName}`;
      const { error: uploadError } = await supabase.storage.from('nourania-content').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) { toast.error(`Erreur upload: ${uploadError.message}`); return; }
      const { data: urlData } = supabase.storage.from('nourania-content').getPublicUrl(filePath);
      const insertData: any = {
        lesson_id: lessonId, content_type: 'audio', file_url: urlData.publicUrl,
        file_name: 'Audio', display_order: existingCount, uploaded_by: user.id,
      };
      if (targetUserId) insertData.target_user_id = targetUserId;
      const { error: insertError } = await supabase.from('nourania_lesson_content').insert(insertData);
      if (insertError) { toast.error(`Erreur: ${insertError.message}`); return; }
      await refetchContents();
      const studentName = targetUserId ? profiles.find((p: any) => p.user_id === targetUserId)?.full_name : null;
      toast.success(studentName ? `Audio envoyé à ${studentName} ✅` : 'Audio téléversé ✅');
    } catch (error) { console.error(error); }
    finally { setIsUploading(false); }
  }, [user, contents, profiles, refetchContents]);

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from('nourania_lesson_content').update({ file_name: title }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-nourania-contents'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const content = contents.find(c => c.id === contentId);
      if (!content) return;
      if (content.content_type !== 'youtube') {
        try {
          const url = new URL(content.file_url);
          const bucketPath = url.pathname.split('/object/public/nourania-content/');
          if (bucketPath[1]) await supabase.storage.from('nourania-content').remove([decodeURIComponent(bucketPath[1])]);
        } catch (e) { console.warn('Could not delete storage file:', e); }
      }
      const { error } = await supabase.from('nourania_lesson_content').delete().eq('id', contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-nourania-contents'] });
      queryClient.invalidateQueries({ queryKey: ['nourania-lesson-contents'] });
      toast.success('Contenu supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const mapContentType = (type: string): ContentType => {
    if (type === 'youtube') return 'youtube';
    if (type === 'audio') return 'audio';
    return 'fichier';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">Gestion du contenu Nourania</h3>
      <p className="text-sm text-muted-foreground">
        Ajoutez des fichiers, vidéos YouTube ou audio pour chaque leçon.
      </p>
      <div className="space-y-3">
        {lessons.map((lesson) => {
          const lessonContents = contents.filter(c => c.lesson_id === lesson.id);
          return (
            <NouraniaLessonCard
              key={lesson.id}
              lesson={lesson}
              lessonContents={lessonContents}
              mapContentType={mapContentType}
              setDeleteContentId={setDeleteContentId}
              updateTitleMutation={updateTitleMutation}
              deleteMutation={deleteMutation}
              handleUploadFile={handleUploadFile}
              handleAddYoutube={handleAddYoutube}
              handleUploadAudio={handleUploadAudio}
              isUploading={isUploading}
              profiles={profiles}
            />
          );
        })}
      </div>
      <ConfirmDeleteDialog
        open={!!deleteContentId}
        onOpenChange={(open) => !open && setDeleteContentId(null)}
        onConfirm={() => { if (deleteContentId) deleteMutation.mutate(deleteContentId); setDeleteContentId(null); }}
        description="Ce contenu sera supprimé définitivement."
      />
    </div>
  );
};

export default AdminNouraniaContent;
