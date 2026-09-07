"use client";
import {useState,useTransition} from "react";
import {setMonthLock} from "@/app/(app)/transactions/lock-actions";

export type MonthRow={month:string;label:string;transactions:number;locked:boolean;lockedByName:string;lockedAt:string};

export function MonthLockModal({months,canLock,canUnlock}:{months:MonthRow[];canLock:boolean;canUnlock:boolean}){
  const [open,setOpen]=useState(false);
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();
  const lockedCount=months.filter(item=>item.locked).length;

  function toggle(row:MonthRow){
    setError("");
    startTransition(async()=>{
      const result=await setMonthLock(row.month,!row.locked);
      if(!result.ok)setError(result.error);
    });
  }

  return <>
    <button className="btn secondary no-print" onClick={()=>{setError("");setOpen(true)}}>
      Month locks{lockedCount?` (${lockedCount})`:""}
    </button>
    {open&&<div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <h2>Month locks</h2>
            <p>A locked month accepts no new entries, edits or deletions until it is unlocked.</p>
          </div>
          <button className="modal-close" onClick={()=>setOpen(false)}>&times;</button>
        </div>
        <div className="delete-body">
          {error&&<p className="form-error">{error}</p>}
          {!canLock&&<p className="text-sm text-slate-500">Your role can view the lock status but not change it.</p>}
          <div className="month-lock-list">
            {months.map(row=><div key={row.month} className={`month-lock-row${row.locked?" is-locked":""}`}>
              <div>
                <strong>{row.label}</strong>
                <div className="text-xs text-slate-500">
                  {row.transactions} transaction{row.transactions===1?"":"s"}
                  {row.locked&&row.lockedByName?` · locked by ${row.lockedByName}`:""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`policy-state is-${row.locked?"expired":"active"}`}>{row.locked?"Locked":"Open"}</span>
                {row.locked
                  ?canUnlock&&<button className="btn secondary" disabled={pending} onClick={()=>toggle(row)}>Unlock</button>
                  :canLock&&<button className="btn secondary" disabled={pending} onClick={()=>toggle(row)}>Lock</button>}
              </div>
            </div>)}
            {!months.length&&<p className="p-4 text-center text-slate-500">No transaction months yet.</p>}
          </div>
          {!canUnlock&&lockedCount>0&&<p className="text-sm text-slate-500">Only an administrator can unlock a month.</p>}
          <div className="modal-actions">
            <button className="btn secondary" onClick={()=>setOpen(false)}>Close</button>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
