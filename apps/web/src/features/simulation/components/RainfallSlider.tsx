import { Slider } from "@/components/ui/slider";

interface RainfallSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  description?: string;
}

export function RainfallSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  onChange,
  description,
}: RainfallSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-mono text-primary">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(Array.isArray(vals) ? vals[0] : (vals as number))}
        className="w-full"
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
