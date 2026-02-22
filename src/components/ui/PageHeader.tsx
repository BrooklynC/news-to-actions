type PageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="mt-2 sm:mt-0">{right}</div>}
    </div>
  );
}
