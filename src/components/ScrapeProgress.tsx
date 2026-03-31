import { Progress } from "@/components/ui/progress";
import { Loader2, Zap, Globe, Database, CheckCircle, AlertCircle } from "lucide-react";

interface ScrapeProgressProps {
  status: string;
  current: number;
  total: number;
  phase: 'idle' | 'connecting' | 'collecting' | 'scraping' | 'done' | 'error';
}

export function ScrapeProgress({ status, current, total, phase }: ScrapeProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  const getIcon = () => {
    switch(phase) {
      case 'connecting': return <Globe className="text-blue-500 animate-pulse" size={20} />;
      case 'collecting': return <Zap className="text-yellow-500 animate-pulse" size={20} />;
      case 'scraping': return <Database className="text-indigo-500 animate-pulse" size={20} />;
      case 'done': return <CheckCircle className="text-green-500" size={20} />;
      case 'error': return <AlertCircle className="text-red-500" size={20} />;
      default: return <Loader2 className="animate-spin text-muted-foreground" size={20} />;
    }
  };

  return (
    <div className="bg-background border-b px-6 py-4 flex flex-col gap-3 shrink-0 shadow-sm z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getIcon()}
          <span className="font-medium text-sm text-foreground">{status}</span>
        </div>
        
        {phase === 'scraping' && total > 0 && (
          <span className="text-sm font-semibold text-muted-foreground">
            {current} / {total} ({percentage}%)
          </span>
        )}
      </div>
      
      {(phase === 'scraping' || phase === 'done') && total > 0 && (
        <Progress value={percentage} className="h-2" />
      )}
    </div>
  );
}
