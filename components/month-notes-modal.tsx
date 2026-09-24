"use client";
import {useState,useTransition} from "react";
import {setMonthNote} from "@/app/(app)/reports/note-actions";

export type MonthNoteRow={month:string;label:string;note:string;updatedByName:string};

// maxLength comes from the server so the limit stays defined in one place (lib/month-notes.ts).
export function MonthNotesModal({months,canEdit,maxLength}:{months:MonthNoteRow[];canEdit:boolean;maxLength:number}){
  const [open,setOpen]=useState(false);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [saved,setSaved]=useState("");
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();
  const noteCount=months.filter(row=>row.note).length;
  const draftFor=(row:MonthNoteRow)=>drafts[row.month]??row.note;

  function save(row:MonthNoteRow){
    setError("");setSaved("");
    startTransition(async()=>{
      const result=await setMonthNote(row.month,draftFor(row));
      if(result.ok)setSaved(row.month);else setError(result.error);
    });
  }

  return <>
    <button className="btn secondary no-print" onClick={()=>{setError("");setSaved("");setDrafts({});setOpen(true)}}>
      Month notes{noteCount?` (${noteCount})`:""}
    </button>
    {open&&<div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <h2>Month notes</h2>
            <p>A note explains the period and appears on the monthly report.</p>
          </div>
          <button className="modal-close" onClick={()=>setOpen(false)}>&times;</button>
        </div>
        <div className="delete-body">
          {error&&<p className="form-error">{error}</p>}
          {!canEdit&&<p className="text-sm text-slate-500">Your role can read month notes but not change them.</p>}
          <div className="month-lock-list">
            {months.map(row=><div key={row.month} className="month-note-row">
              <div className="flex items-center justify-between gap-2">
                <strong>{row.label}</strong>
                {row.updatedByName&&<span className="text-xs text-slate-500">Last saved by {row.updatedByName}</span>}
              </div>
              <textarea className="field" rows={2} maxLength={maxLength} disabled={!canEdit||pending}
                placeholder="Add a note for this month" value={draftFor(row)}
                onChange={event=>{setSaved("");setDrafts(state=>({...state,[row.month]:event.target.value}))}}/>
              {canEdit&&<div className="flex items-center gap-2">
                <button className="btn secondary" disabled={pending||draftFor(row)===row.note} onClick={()=>save(row)}>Save</button>
                {saved===row.month&&<span className="text-xs text-slate-500">Saved</span>}
              </div>}
            </div>)}
            {!months.length&&<p className="p-4 text-center text-slate-500">No transaction months yet.</p>}
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={()=>setOpen(false)}>Close</button>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
