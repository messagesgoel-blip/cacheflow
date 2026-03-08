import React from 'react';

interface StatusBadgeProps {
  status?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const safeStatus = status || 'unknown';

  const getStatusClasses = (status: string) => {
    switch (status.toLowerCase()) {
      case 'synced':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'syncing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const statusText = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1).toLowerCase();

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusClasses(safeStatus)}`}>
      {statusText}
    </span>
  );
};

export default StatusBadge;
