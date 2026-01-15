import { useEffect } from 'react';
import { useDocumentStore } from '../../store';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export const Toast = () => {
  const toast = useDocumentStore((state) => state.toast);
  const hideToast = useDocumentStore((state) => state.hideToast);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast();
      }, 5000); // Auto-dismiss after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />,
    error: <XCircle size={20} className="text-red-600 dark:text-red-400" />,
    info: <Info size={20} className="text-blue-600 dark:text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  const textColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    info: 'text-blue-800 dark:text-blue-200',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${bgColors[toast.type]} ${textColors[toast.type]} min-w-[300px] max-w-[500px]`}
      >
        <div className="flex-shrink-0">{icons[toast.type]}</div>
        <div className="flex-1 text-sm font-medium whitespace-pre-line">{toast.message}</div>
        <button
          onClick={hideToast}
          className="flex-shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
          aria-label="Close notification"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
