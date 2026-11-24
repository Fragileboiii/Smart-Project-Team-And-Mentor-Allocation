import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  active:      'bg-emerald-500/20 text-emerald-400',
  allocated:   'bg-indigo-500/20 text-indigo-300',
  forming:     'bg-cyan-500/20 text-cyan-400',
  pending:     'bg-amber-500/20 text-amber-400',
  queued:      'bg-amber-500/20 text-amber-400',
  processing:  'bg-blue-500/20 text-blue-400',
  waiting:     'bg-orange-500/20 text-orange-400',
  completed:   'bg-emerald-500/20 text-emerald-400',
  cancelled:   'bg-slate-500/20 text-slate-400',
  rejected:    'bg-rose-500/20 text-rose-400',
  failed:      'bg-rose-500/20 text-rose-400',
  safe:        'bg-emerald-500/20 text-emerald-400',
  unsafe:      'bg-rose-500/20 text-rose-400',
  acquired:    'bg-amber-500/20 text-amber-400',
  released:    'bg-emerald-500/20 text-emerald-400',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('badge', statusStyles[status.toLowerCase()] || 'bg-slate-500/20 text-slate-400')}>
      {status}
    </span>
  );
}
