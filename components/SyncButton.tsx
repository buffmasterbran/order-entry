'use client';

import { RefreshCw, Check, X } from 'lucide-react';

interface SyncButtonProps {
  onSync: () => void;
  status: 'idle' | 'syncing' | 'success' | 'error';
}

export default function SyncButton({ onSync, status }: SyncButtonProps) {
  const getButtonContent = () => {
    switch (status) {
      case 'syncing':
        return (
          <>
            <RefreshCw size={18} className="animate-spin" />
            Syncing...
          </>
        );
      case 'success':
        return (
          <>
            <Check size={18} />
            Synced
          </>
        );
      case 'error':
        return (
          <>
            <X size={18} />
            Error
          </>
        );
      default:
        return (
          <>
            <RefreshCw size={18} />
            Sync
          </>
        );
    }
  };

  const getButtonClass = () => {
    const base = 'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors';
    switch (status) {
      case 'syncing':
        return `${base} bg-blue-400 text-white cursor-not-allowed`;
      case 'success':
        return `${base} bg-green-600 text-white`;
      case 'error':
        return `${base} bg-red-600 text-white`;
      default:
        return `${base} bg-blue-600 text-white hover:bg-blue-700`;
    }
  };

  return (
    <button
      onClick={onSync}
      disabled={status === 'syncing'}
      className={getButtonClass()}
    >
      {getButtonContent()}
    </button>
  );
}




