import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Check, BookOpen, FileText, Video, Image, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourate: {
    number: number;
    name_arabic: string;
    name_french: string;
    verses_count: number;
    revelation_type: string;
  };
  dbId: number | undefined;
  verseProgress: Map<string, boolean>;
  sourateProgress: { is_validated: boolean; is_memorized: boolean; progress_percentage: number } | undefined;
  contents: any[];
  onVerseToggle: (dbId: number, verseNum: number, sourateNumber: number, versesCount: number) => void;
}

const SourateDetailDialog = ({
  open,
  onOpenChange,
  sourate,
  dbId,
  verseProgress,
  sourateProgress,
  contents,
  onVerseToggle,
}: SourateDetailDialogProps) => {
  if (!dbId) return null;

  let validatedVerses = 0;
  for (let i = 1; i <= sourate.verses_count; i++) {
    if (verseProgress.get(`${dbId}-${i}`)) validatedVerses++;
  }
  const versePercentage = Math.round((validatedVerses / sourate.verses_count) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
              sourateProgress?.is_validated
                ? 'bg-green-500 text-white'
                : 'bg-gradient-to-br from-primary to-royal-dark text-primary-foreground'
            )}>
              {sourateProgress?.is_validated ? <Check className="h-5 w-5" /> : sourate.number}
            </div>
            <div>
              <p className="font-arabic text-lg">{sourate.name_arabic}</p>
              <p className="text-sm text-muted-foreground font-normal">{sourate.name_french}</p>
              <p className="text-xs text-muted-foreground/70 font-normal">
                {sourate.verses_count} versets • {sourate.revelation_type} • {validatedVerses}/{sourate.verses_count} validés
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium text-primary">{versePercentage}%</span>
            </div>
            <Progress value={versePercentage} className="h-2" />
          </div>

          {/* Resources */}
          {contents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Ressources</p>
              {contents.map((content: any) => (
                <div key={content.id}>
                  {content.content_type === 'video' && (
                    <video controls className="w-full rounded-lg" src={content.file_url}>
                      Votre navigateur ne supporte pas la lecture vidéo.
                    </video>
                  )}
                  {content.content_type === 'pdf' && (
                    <a href={content.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm">{content.file_name}</span>
                    </a>
                  )}
                  {content.content_type === 'image' && (
                    <img src={content.file_url} alt={content.file_name} className="w-full rounded-lg" />
                  )}
                  {content.content_type === 'document' && (
                    <a href={content.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <File className="h-4 w-4" />
                      <span className="text-sm">{content.file_name}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Verses */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Versets</p>
            <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto">
              {Array.from({ length: sourate.verses_count }, (_, i) => i + 1).map(verseNum => {
                const isVerseValidated = verseProgress.get(`${dbId}-${verseNum}`) || false;
                return (
                  <div
                    key={verseNum}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg transition-colors',
                      isVerseValidated ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted/30'
                    )}
                  >
                    <Checkbox
                      checked={isVerseValidated}
                      onCheckedChange={() => onVerseToggle(dbId, verseNum, sourate.number, sourate.verses_count)}
                      className={cn(
                        'h-5 w-5 rounded border-2',
                        isVerseValidated ? 'border-green-500 bg-green-500 data-[state=checked]:bg-green-500' : 'border-gold'
                      )}
                    />
                    <span className={cn(
                      'text-sm',
                      isVerseValidated ? 'text-green-600 dark:text-green-400 line-through' : 'text-foreground'
                    )}>
                      Verset {verseNum}
                    </span>
                    {isVerseValidated && <Check className="h-4 w-4 text-green-500 ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Memorization tips */}
          <div className="bg-muted/50 rounded-xl p-3 text-sm">
            <p className="font-medium text-foreground flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-gold" />
              Techniques de mémorisation
            </p>
            <ul className="text-muted-foreground text-xs space-y-1 ml-6">
              <li>• Écouter plusieurs fois</li>
              <li>• Répéter à voix haute</li>
              <li>• Réviser régulièrement</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SourateDetailDialog;
