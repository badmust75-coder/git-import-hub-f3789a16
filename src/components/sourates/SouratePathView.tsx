import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import charGirlReading from '@/assets/char-girl-reading.png';
import charBoyPraying from '@/assets/char-boy-praying.png';
import charBoyChapelet from '@/assets/char-boy-chapelet.png';
import charGirlPraying from '@/assets/char-girl-praying.png';

const CHARACTER_IMAGES = [
  { src: charGirlReading, alt: 'Fille lisant le Coran' },
  { src: charBoyPraying, alt: 'Garçon en prière' },
  { src: charBoyChapelet, alt: 'Garçon avec chapelet' },
  { src: charGirlPraying, alt: 'Fille en prière' },
];

interface SouratePathViewProps {
  sourates: Array<{
    number: number;
    name_arabic: string;
    name_french: string;
    verses_count: number;
    revelation_type: string;
  }>;
  dbSourates: Map<number, number>;
  sourateProgress: Map<number, { is_validated: boolean; is_memorized: boolean; progress_percentage: number }>;
  isSourateAccessible: (num: number) => boolean;
  onSourateClick: (sourate: any) => void;
}

const ITEMS_PER_ROW = 5;

// Star SVG path
const StarBadge = ({
  number,
  isValidated,
  isAccessible,
  onClick,
}: {
  number: number;
  isValidated: boolean;
  isAccessible: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-12 h-12 flex items-center justify-center transition-all duration-200',
        isAccessible && !isValidated && 'hover:scale-110',
        !isAccessible && 'cursor-not-allowed'
      )}
      disabled={!isAccessible}
    >
      {/* Star shape */}
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-md">
        <path
          d="M24 2 L29.5 17.5 L46 17.5 L33 27.5 L37.5 44 L24 34 L10.5 44 L15 27.5 L2 17.5 L18.5 17.5 Z"
          fill={isValidated ? 'url(#greenGrad)' : isAccessible ? 'url(#amberGrad)' : '#d1d5db'}
          stroke={isValidated ? '#16a34a' : isAccessible ? '#d97706' : '#9ca3af'}
          strokeWidth="1.5"
        />
        <defs>
          <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
      </svg>
      {/* Number */}
      <span className={cn(
        'absolute inset-0 flex items-center justify-center font-bold text-[10px] leading-none pt-0.5',
        isValidated ? 'text-white' : isAccessible ? 'text-amber-900' : 'text-gray-500'
      )}>
        {number}
      </span>
      {/* Lock indicator */}
      {!isAccessible && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
          <Lock className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      )}
    </button>
  );
};

const SouratePathView = ({
  sourates,
  dbSourates,
  sourateProgress,
  isSourateAccessible,
  onSourateClick,
}: SouratePathViewProps) => {
  // Split into rows
  const rows: typeof sourates[] = [];
  for (let i = 0; i < sourates.length; i += ITEMS_PER_ROW) {
    rows.push(sourates.slice(i, i + ITEMS_PER_ROW));
  }

  let characterIndex = 0;

  return (
    <div className="space-y-2 py-4">
      {rows.map((row, rowIndex) => {
        const isRightToLeft = rowIndex % 2 === 0; // even rows: right-to-left (114 starts right)
        const orderedRow = isRightToLeft ? [...row] : [...row].reverse();
        const showCharacter = rowIndex < rows.length - 1; // no character after last row
        const charImg = CHARACTER_IMAGES[characterIndex % CHARACTER_IMAGES.length];
        const charOnRight = isRightToLeft; // character at end of direction (turn point)

        if (showCharacter) characterIndex++;

        return (
          <div key={rowIndex}>
            {/* Stars row */}
            <div
              className={cn(
                'flex items-center gap-1 px-2',
                isRightToLeft ? 'justify-end' : 'justify-start'
              )}
            >
              {orderedRow.map((sourate) => {
                const dbId = dbSourates.get(sourate.number);
                const progress = dbId ? sourateProgress.get(dbId) : undefined;
                const accessible = isSourateAccessible(sourate.number);

                return (
                  <StarBadge
                    key={sourate.number}
                    number={sourate.number}
                    isValidated={!!progress?.is_validated}
                    isAccessible={accessible}
                    onClick={() => onSourateClick(sourate)}
                  />
                );
              })}
            </div>

            {/* Character at turn */}
            {showCharacter && (
              <div className={cn(
                'flex py-1',
                charOnRight ? 'justify-start pl-4' : 'justify-end pr-4'
              )}>
                <img
                  src={charImg.src}
                  alt={charImg.alt}
                  className="w-12 h-12 object-contain"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SouratePathView;
