import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface StatusBadgeProps {
  status?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const safeStatus = status || 'unknown';

  const getVariant = (status: string): "success" | "warning" | "default" | "destructive" => {
    switch (status.toLowerCase()) {
      case 'synced':
        return 'success';
      case 'pending':
        return 'warning';
      case 'syncing':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const statusText = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1).toLowerCase();

  return (
    <Badge variant={getVariant(safeStatus)}>
      {statusText}
    </Badge>
  );
};

export default StatusBadge;
