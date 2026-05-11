import './arco.css';

export const metadata = {
  title: 'ARCO Group — Questionario',
  description: 'Registrazione e questionario di pre-assessment per il workshop di crescita personale e AI — ARCO Group',
};

export default function ArcoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="arco-page">
      <div className="arco-bg-pattern" />
      {children}
    </div>
  );
}
