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
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {icon && (
        <div className="empty-icon text-5xl mb-4 opacity-40">
          {icon}
        </div>
      )}
      <p className="empty-title text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
        {title}
      </p>
      {description && (
        <p className="empty-subtitle text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;