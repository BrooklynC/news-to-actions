type PageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base leading-relaxed text-stone-600 dark:text-stone-400">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="mt-2 sm:mt-0">{right}</div>}
    </div>
  );
}
