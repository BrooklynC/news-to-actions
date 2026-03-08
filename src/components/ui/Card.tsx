type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-stone-200/60 bg-white/90 shadow-[0_2px_16px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-stone-700/50 dark:bg-stone-900/80 dark:shadow-none dark:hover:border-stone-600/50 ${className}`}
    >
      {children}
    </div>
  );
}
