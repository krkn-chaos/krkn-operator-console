import type { ReactNode } from 'react';

interface MetadataPanelProps {
  id: string;
  title: string;
  icon?: ReactNode;
  scale?: string;
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}

export function MetadataPanel({ id, title, icon, scale, items, className = '' }: MetadataPanelProps) {
  return (
    <section className={`krkn-ai-run-detail__metadata-group ${className}`} aria-labelledby={id}>
      <h2 id={id} className="krkn-ai-run-detail__metadata-heading">
        {icon}{title}
        {scale && <span className="krkn-ai-run-detail__fitness-scale" aria-hidden="true">{scale}</span>}
      </h2>
      <dl className="krkn-ai-run-detail__metadata" aria-label={scale ? `${title}, scale ${scale}` : undefined}>
        {items.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  );
}
