interface ProcessingErrorAlertProps {
  error: string;
}

export function ProcessingErrorAlert({ error }: ProcessingErrorAlertProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <div>
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          Processing Error
        </p>
        <p className="max-w-prose text-sm text-red-700 dark:text-red-300 mt-0.5">
          {error}
        </p>
      </div>
    </div>
  );
}
