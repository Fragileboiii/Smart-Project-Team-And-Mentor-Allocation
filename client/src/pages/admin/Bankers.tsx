import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { osApi } from '../../services/api';
import { BankersState, SafetyResult } from '../../types';
import { Brain, Play, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

const DEFAULT_STATE: BankersState = {
  processes: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'],
  resources: ['Mentor-OS', 'Mentor-ML', 'Mentor-Web'],
  available: [3, 3, 2],
  max: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3],
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2],
  ],
};

export default function AdminBankers() {
  const [state, setState] = useState<BankersState>(DEFAULT_STATE);
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [reqProcess, setReqProcess] = useState(0);
  const [reqVector, setReqVector] = useState<number[]>([1, 0, 2]);
  const [reqResult, setReqResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function checkSafety() {
    setLoading(true);
    try {
      const r = await osApi.checkSafety(state);
      setResult(r.data);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function simulateRequest() {
    setLoading(true);
    try {
      const r = await osApi.simulateRequest({ state, processIndex: reqProcess, request: reqVector });
      setReqResult(r.data);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  }

  const need = state.max.map((row, i) => row.map((v, j) => v - state.allocation[i][j]));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Brain size={24} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">Banker's Algorithm Simulator</h1>
        </div>

        {/* Explainer */}
        <div className="card border-amber-500/30">
          <p className="text-xs text-slate-400 font-medium mb-1">OS Concept: Deadlock Avoidance</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Each mentor is a resource type with a finite number of slots. The safety algorithm checks whether
            all processes (teams) can eventually complete given current allocations and maximum demands.
            A request is only granted if the resulting state remains safe (no circular wait possible).
            <br /><br />
            Need[i][j] = Max[i][j] − Allocation[i][j]. The safety algorithm finds a sequence where each process
            can obtain its remaining needs using available + released resources.
          </p>
        </div>

        {/* Matrices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Available */}
          <div className="card">
            <h3 className="font-semibold text-white mb-3 text-sm">Available Resources</h3>
            <div className="flex gap-3">
              {state.resources.map((r, j) => (
                <div key={j} className="text-center">
                  <p className="text-xs text-slate-500 mb-1">{r}</p>
                  <input type="number" min="0" className="w-14 input text-center text-sm"
                    value={state.available[j]}
                    onChange={e => setState(s => {
                      const a = [...s.available]; a[j] = +e.target.value;
                      return { ...s, available: a };
                    })} />
                </div>
              ))}
            </div>
          </div>

          {/* Safety result */}
          {result && (
            <div className={`card ${result.isSafe ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.isSafe
                  ? <CheckCircle size={18} className="text-emerald-400" />
                  : <XCircle size={18} className="text-rose-400" />
                }
                <span className={`font-semibold text-sm ${result.isSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {result.isSafe ? 'SAFE STATE' : 'UNSAFE STATE'}
                </span>
              </div>
              {result.isSafe && (
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  {result.safeSequence.map((p, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="badge bg-indigo-500/20 text-indigo-300">{p}</span>
                      {i < result.safeSequence.length - 1 && <ChevronRight size={12} className="text-slate-600" />}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Allocation table */}
        <div className="card overflow-x-auto">
          <h3 className="font-semibold text-white mb-3 text-sm">Allocation / Max / Need Matrices</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left pb-2 pr-4">Process</th>
                {state.resources.map(r => <th key={r} className="pb-2 px-2 text-center" colSpan={3}>{r}</th>)}
              </tr>
              <tr className="text-slate-600">
                <th />
                {state.resources.map(r => (
                  <>
                    <th key={`${r}-a`} className="pb-1 px-1 text-center font-normal">Alloc</th>
                    <th key={`${r}-m`} className="pb-1 px-1 text-center font-normal">Max</th>
                    <th key={`${r}-n`} className="pb-1 px-1 text-center font-normal text-amber-400">Need</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.processes.map((p, i) => (
                <tr key={i} className="border-t border-navy-700">
                  <td className="py-1.5 pr-4 text-slate-300 font-medium">{p}</td>
                  {state.resources.map((_, j) => (
                    <React.Fragment key={j}>
                      <td className="py-1.5 px-1 text-center">
                        <input type="number" min="0" className="w-10 bg-navy-700 text-slate-200 text-center rounded px-1 py-0.5 border border-navy-600"
                          value={state.allocation[i][j]}
                          onChange={e => setState(s => {
                            const a = s.allocation.map(r => [...r]); a[i][j] = +e.target.value;
                            return { ...s, allocation: a };
                          })} />
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        <input type="number" min="0" className="w-10 bg-navy-700 text-slate-200 text-center rounded px-1 py-0.5 border border-navy-600"
                          value={state.max[i][j]}
                          onChange={e => setState(s => {
                            const m = s.max.map(r => [...r]); m[i][j] = +e.target.value;
                            return { ...s, max: m };
                          })} />
                      </td>
                      <td className="py-1.5 px-1 text-center text-amber-400 font-mono">
                        {need[i][j]}
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Check safety */}
        <div className="flex gap-3">
          <button onClick={checkSafety} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            <Play size={14} /> Check Safety
          </button>
        </div>

        {/* Step trace */}
        {result && result.steps.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-white mb-3 text-sm">Safety Algorithm Steps</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono">
              {result.steps.filter(s => s.canProceed).map((s, i) => (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-slate-300">{s.process}</span>
                  <span className="text-slate-500">need=[{s.need.join(',')}] work=[{s.work.join(',')}] → [{s.workAfter.join(',')}]</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulate request */}
        <div className="card">
          <h3 className="font-semibold text-white mb-3 text-sm">Simulate Resource Request</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Process</label>
              <select className="input w-32 text-sm" value={reqProcess} onChange={e => setReqProcess(+e.target.value)}>
                {state.processes.map((p, i) => <option key={i} value={i}>{p}</option>)}
              </select>
            </div>
            {state.resources.map((r, j) => (
              <div key={j}>
                <label className="block text-xs text-slate-400 mb-1">{r}</label>
                <input type="number" min="0" className="input w-16 text-sm"
                  value={reqVector[j] || 0}
                  onChange={e => setReqVector(v => { const n = [...v]; n[j] = +e.target.value; return n; })} />
              </div>
            ))}
            <button onClick={simulateRequest} disabled={loading} className="btn-primary text-sm flex items-center gap-1">
              <Play size={13} /> Simulate
            </button>
          </div>
          {reqResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${reqResult.granted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <span className="font-medium">{reqResult.granted ? '✓ Granted' : '✗ Denied'}: </span>
              {reqResult.reason}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
