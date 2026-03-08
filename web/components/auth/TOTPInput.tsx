/**
 * TOTP Input Component
 * 
 * 6-digit input for TOTP codes with auto-focus and formatting.
 * 
 * Gate: 2FA-1
 * Task: 2.14@2FA-1
 */

'use client';

import React, { useRef, useEffect } from 'react';

export interface TOTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const TOTPInput: React.FC<TOTPInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(newValue);
    
    if (newValue.length === 6 && onComplete) {
      onComplete(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow backspace, delete, arrow keys
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return;
    }
    
    // Only allow digits
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pastedData);
    
    if (pastedData.length === 6 && onComplete) {
      onComplete(pastedData);
    }
  };

  // Format value with spaces for display
  const formatValue = (val: string) => {
    return val.replace(/(\d{3})(\d{1,3})?/, (match, p1, p2) => {
      return p2 ? `${p1} ${p2}` : p1;
    });
  };

  return (
    <div className="flex justify-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={7} // 6 digits + 1 space
        value={formatValue(value)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        disabled={disabled}
        placeholder="000 000"
        autoComplete="one-time-code"
        className="w-48 text-center text-3xl font-mono tracking-widest py-3 px-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Two-factor authentication code"
      />
    </div>
  );
};

export default TOTPInput;

