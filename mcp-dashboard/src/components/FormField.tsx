import { Label } from "@/components/ui/label";

interface Props {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function FormField({ label, children, className = "" }: Props) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
