import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminModuleCardProps {
  title: string;
  icon: LucideIcon;
  value: string | number;
  subtitle?: string;
  color: string;
  bgColor: string;
  onClick: () => void;
  isActive?: boolean;
}

const AdminModuleCard = ({
  title,
  icon: Icon,
  value,
  subtitle,
  color,
  bgColor,
  onClick,
  isActive = false,
}: AdminModuleCardProps) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-300 hover:shadow-elevated',
        isActive && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-3 rounded-xl', bgColor)}>
              <Icon className={cn('h-6 w-6', color)} />
            </div>
            <div>
              <p className="font-bold text-foreground">{title}</p>
              <p className="text-lg font-semibold text-primary">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminModuleCard;
