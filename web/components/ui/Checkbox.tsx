import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const [checked, setChecked] = React.useState(props.checked || props.defaultChecked || false);

    React.useEffect(() => {
      if (props.checked !== undefined) {
        setChecked(props.checked);
      }
    }, [props.checked]);

    return (
      <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            id={id}
            ref={ref}
            className="sr-only peer"
            onChange={(e) => {
              setChecked(e.target.checked);
              props.onChange?.(e);
            }}
            {...props}
          />
          <div
            className={cn(
              "h-4 w-4 rounded border border-[var(--border-strong)] bg-[var(--bg-surface-raised)]",
              "peer-focus:ring-2 peer-focus:ring-[var(--accent-blue)] peer-focus:ring-offset-2",
              "peer-checked:bg-[var(--accent-blue)] peer-checked:border-[var(--accent-blue)]",
              "transition-colors"
            )}
          >
            {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </div>
        </div>
        {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
