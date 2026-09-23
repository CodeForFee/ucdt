import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface LoadingSkeletonProps {
  count?: number;
  variant?: "card" | "list" | "chart";
}

function SkeletonPulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted/60 rounded ${className}`} />;
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <SkeletonPulse className="h-4 w-32" />
        <SkeletonPulse className="h-3 w-24 mt-1" />
      </CardHeader>
      <CardContent>
        <SkeletonPulse className="h-8 w-20 mb-2" />
        <SkeletonPulse className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
          <SkeletonPulse className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonPulse className="h-3 w-3/4" />
            <SkeletonPulse className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <SkeletonPulse className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <SkeletonPulse className="h-48 w-full" />
      </CardContent>
    </Card>
  );
}

export function LoadingSkeleton({ count = 4, variant = "card" }: LoadingSkeletonProps) {
  if (variant === "list") return <ListSkeleton />;
  if (variant === "chart") return <ChartSkeleton />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
