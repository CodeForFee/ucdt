interface DataSourceTagProps {
  source: string;
  className?: string;
}

export function DataSourceTag({ source, className = "" }: DataSourceTagProps) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs text-muted-foreground bg-muted/50 border border-border/50 ${className}`}>
      {source}
    </span>
  );
}
