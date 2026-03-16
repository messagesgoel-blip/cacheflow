import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, checked, defaultChecked, onChange, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(defaultChecked || false);

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked);
      }
    }, [checked]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsChecked(e.target.checked);
      onChange?.(e);
    };

    return (
      <label htmlFor={id} className="inline-flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            id={id}
            ref={ref}
            className="sr-only peer"
            checked={isChecked}
            onChange={handleChange}
            {...props}
          />
          <div
            className={cn(
              "h-6 w-11 rounded-full transition-colors",
              "bg-[var(--border-strong)] peer-checked:bg-[var(--accent-blue)]",
              "peer-focus:ring-2 peer-focus:ring-[var(--accent-blue)] peer-focus:ring-offset-2"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm",
                "transition-transform peer-checked:translate-x-5",
                "flex items-center justify-center"
              )}
            />
          </div>
        </div>
        {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
