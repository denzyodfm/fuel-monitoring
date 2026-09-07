"use client";
import {useMemo,useState,useTransition} from "react";
import {mergeVehicles} from "@/app/(app)/vehicles/merge-actions";

export type MergeCandidate={id:string;label:string;transactions:number;policies:number;odometerLogs:number;company:string;driver:string};
export type MergeGroup={key:string;ids:string[]};

export function VehicleMerge({candidates,groups}:{candidates:MergeCandidate[];groups:MergeGroup[]}){
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [survivor,setSurvivor]=useState("");
  const [search,setSearch]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [error,setError]=useState("");
  const [done,setDone]=useState("");
  const [pending,startTransition]=useTransition();

  const byId=useMemo(()=>new Map(candidates.map(item=>[item.id,item])),[candidates]);
  const listed=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return term?candidates.filter(item=>item.label.toLowerCase().includes(term)):candidates;
  },[candidates,search]);
  const chosen=selected.map(id=>byId.get(id)).filter(Boolean) as MergeCandidate[];
  const totalMoving=chosen.filter(item=>item.id!==survivor).reduce((sum,item)=>sum+item.transactions,0);

  function toggle(id:string){
    setDone("");
    const next=selected.includes(id)?selected.filter(item=>item!==id):[...selected,id];
    setSelected(next);
    if(!next.includes(survivor))setSurvivor(next[0]??"");
  }
  function loadGroup(group:MergeGroup){
    setDone("");setError("");
    setSelected(group.ids);
    // Default to keeping whichever record already carries the most history.
    const richest=[...group.ids].map(id=>byId.get(id)!).sort((a,b)=>b.transactions-a.transactions)[0];
    setSurvivor(richest?.id??group.ids[0]);
    setOpen(true);
  }
  function submit(){
    setError("");
    startTransition(async()=>{
      const result=await mergeVehicles(survivor,selected.filter(id=>id!==survivor),confirmation);
      if(result.ok){
        const moved=result.moved!;
        setDone(`Merged ${moved.removed} record${moved.removed===1?"":"s"} into ${byId.get(survivor)?.label}. Moved ${moved.transactions} transaction${moved.transactions===1?"":"s"}${moved.policies?`, ${moved.policies} polic${moved.policies===1?"y":"ies"}`:""}.`);
        setSelected([]);setSurvivor("");setConfirmation("");setOpen(false);
      }else setError(result.error);
    });
  }

  return <div className="card merge-panel no-print">
    <div className="merge-head">
      <div>
        <h2 className="text-lg font-bold m-0">Combine duplicate records</h2>
        <p className="text-sm text-slate-500 m-0">
          The same vehicle can sit in the list more than once under different spellings. Merging keeps
          one record and moves every transaction, policy and odometer reading onto it.
        </p>
      </div>
      <button className="btn secondary" onClick={()=>{setOpen(!open);setDone("")}}>{open?"Close":"Open merge tool"}</button>
    </div>

    {done&&<p className="form-success mt-3">{done}</p>}

    {groups.length>0&&<div className="merge-suggestions">
      <span className="text-sm text-slate-500">Likely duplicates:</span>
      {groups.map(group=><button key={group.key} className="merge-chip" onClick={()=>loadGroup(group)}>
        {group.key} <b>×{group.ids.length}</b>
      </button>)}
    </div>}

    {open&&<div className="merge-body">
      <label className="management-search">Search
        <input className="field" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find a vehicle…" autoComplete="off"/>
      </label>

      <div className="merge-list">
        {listed.map(item=><label key={item.id} className={`merge-row${selected.includes(item.id)?" is-selected":""}`}>
          <input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggle(item.id)}/>
          <span className="merge-label">{item.label}</span>
          <span className="merge-meta">{item.transactions} fuel · {item.policies} policies{item.company?` · ${item.company}`:""}</span>
        </label>)}
        {!listed.length&&<p className="p-4 text-center text-slate-500">No vehicles match that search.</p>}
      </div>

      {chosen.length>1&&<div className="merge-confirm">
        <p className="m-0"><strong>Keep this record</strong> — the others are removed and their history moves onto it.</p>
        <div className="merge-keep">
          {chosen.map(item=><label key={item.id} className={`merge-row${survivor===item.id?" is-selected":""}`}>
            <input type="radio" name="survivor" checked={survivor===item.id} onChange={()=>setSurvivor(item.id)}/>
            <span className="merge-label">{item.label}</span>
            <span className="merge-meta">{item.transactions} fuel records</span>
          </label>)}
        </div>
        <p className="text-sm text-slate-500 m-0">
          {chosen.length-1} record{chosen.length-1===1?"":"s"} will be removed and {totalMoving} transaction{totalMoving===1?"":"s"} moved.
          The old spellings are kept as aliases so future Excel imports still match.
        </p>
        {error&&<p className="form-error">{error}</p>}
        <div className="merge-actions">
          <label>Type <strong>MERGE</strong> to confirm
            <input className="field" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/>
          </label>
          <button className="btn" disabled={pending||!survivor} onClick={submit}>{pending?"Merging…":"Merge records"}</button>
          <button className="btn secondary" onClick={()=>{setSelected([]);setSurvivor("");setConfirmation("");setError("")}}>Clear</button>
        </div>
      </div>}
    </div>}
  </div>;
}
