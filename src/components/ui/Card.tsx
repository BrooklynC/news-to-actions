type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200/70 bg-white shadow-sm transition-shadow transition-transform duration-200 hover:shadow-md hover:-translate-y-0.5 active:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  );
}
