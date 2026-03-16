/**
 * EmptyState Component
 *
 * Reusable empty state display for lists and tables.
 * Provides consistent styling across the application.
 *
 * Task: APP-08
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';

interface EmptyStateProps {
  /** Icon emoji or component to display */
  icon?: React.ReactNode;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button */
  action?: React.ReactNode;
  /** Test ID for automation */
  'data-testid'?: string;
}

/**
 * EmptyState Component
 *
 * Displays a consistent empty state with icon, title, description, and optional action.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  'data-testid': testId,
}) => {
  return (
    <Card
      data-testid={testId}
      className="flex flex-col items-center justify-center py-12 px-6 text-center border-dashed"
    >
      <CardContent className="flex flex-col items-center">
        {icon && (
          <div className="text-5xl mb-4 opacity-40">
            {icon}
          </div>
        )}
        <p className="text-lg font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
        {description && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        )}
        {action && (
          <div className="mt-4">
            {action}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmptyState;
