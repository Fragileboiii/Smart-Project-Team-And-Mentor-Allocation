import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Student } from '../types';

export interface SwipeCardHandle {
  swipe: (dir: 'left' | 'right') => void;
}

interface Props {
  student: Student;
  onSwipe: (dir: 'left' | 'right') => void;
  active: boolean;
}

const SwipeCard = forwardRef<SwipeCardHandle, Props>(({ student, onSwipe, active }, ref) => {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<null | 'left' | 'right'>(null);
  const start = useRef({ x: 0, y: 0 });
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`;
  const rot = drag.x / 18;
  const likeOpacity = Math.min(Math.max(drag.x / 120, 0), 1);
  const nopeOpacity = Math.min(Math.max(-drag.x / 120, 0), 1);

  function fly(dir: 'left' | 'right') {
    if (leaving) return;
    setLeaving(dir);
    setDrag({ x: dir === 'right' ? 600 : -600, y: dragRef.current.y });
    setTimeout(() => onSwipe(dir), 260);
  }

  // Re-bind every render so the parent's ref always calls the latest fly().
  useImperativeHandle(ref, () => ({ swipe: fly }));

  function onPointerDown(e: React.PointerEvent) {
    if (!active || leaving) return;
    setDragging(true);
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    const threshold = 120;
    if (drag.x > threshold) fly('right');
    else if (drag.x < -threshold) fly('left');
    else setDrag({ x: 0, y: 0 });
  }

  return (
    <div
      className="absolute inset-0 select-none touch-none"
      style={{
        transform: `translate(${drag.x}px, ${drag.y / 8}px) rotate(${rot}deg)`,
        transition: dragging ? 'none' : 'transform 0.26s ease',
        zIndex: active ? 30 : 10,
        opacity: leaving ? 0 : 1,
        pointerEvents: active ? 'auto' : 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="card h-full flex flex-col overflow-hidden relative">
        <div
          className="absolute top-6 left-6 border-4 border-emerald-400 text-emerald-400 text-3xl font-extrabold px-3 py-1 rounded-lg z-20"
          style={{ opacity: likeOpacity, transform: 'rotate(-18deg)' }}
        >
          LIKE
        </div>
        <div
          className="absolute top-6 right-6 border-4 border-rose-400 text-rose-400 text-3xl font-extrabold px-3 py-1 rounded-lg z-20"
          style={{ opacity: nopeOpacity, transform: 'rotate(18deg)' }}
        >
          NOPE
        </div>

        <div className="h-44 bg-gradient-to-br from-indigo-500 via-indigo-400 to-cyan-500 flex items-center justify-center">
          <span className="text-6xl font-bold text-white/90">{initials}</span>
        </div>

        <div className="p-5 flex-1 flex flex-col overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-white">{student.first_name} {student.last_name}</h3>
            <span className="badge bg-cyan-500/20 text-cyan-300">Section {student.section || '—'}</span>
            {student.invitedByMe && <span className="badge bg-amber-500/20 text-amber-300">Invite sent</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {student.roll_number} · {student.department} · Sem {student.semester}
            {student.cgpa ? ` · CGPA ${student.cgpa}` : ''}
          </p>
          {student.bio && <p className="text-sm text-slate-300 mt-3">{student.bio}</p>}
          {student.project_interests && (
            <p className="text-xs text-slate-500 mt-2">Interests: {student.project_interests}</p>
          )}
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1.5">Tech Stack</p>
            <div className="flex flex-wrap gap-1.5">
              {(student.skills || []).map((s: any) => (
                <span key={s.name} className="badge bg-indigo-500/20 text-indigo-300">
                  {s.name}<span className="ml-1 text-[10px] text-indigo-400/70">{s.proficiency}</span>
                </span>
              ))}
              {!student.skills?.length && <span className="text-xs text-slate-500">No skills listed</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SwipeCard;
