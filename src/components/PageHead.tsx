import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}

export function PageHead({ eyebrow, title, action }: Props) {
  return (
    <header className="page-head">
      {action}
      <div className="head-text">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
    </header>
  );
}
