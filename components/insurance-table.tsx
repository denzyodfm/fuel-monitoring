"use client";
import {useMemo,useState,useTransition} from "react";
import * as XLSX from "xlsx";
import type {VehicleCategory} from "@/lib/vehicle-category";
import {deleteInsurancePolicy,saveInsurancePolicy} from "@/app/(app)/insurance/actions";

export type PolicyRecord={
  id:string;vehicleId:string;vehicle:string;category:VehicleCategory;insurer:string;policyNumber:string;
  policyStart:string;policyEnd:string;premium:string;registeredOwner:string;
  assignedDriver:string;status:string;remarks:string;
  daysRemaining:number;state:"EXPIRED"|"EXPIRING"|"ACTIVE";
};
export type VehicleHistory={
  vehicleId:string;vehicle:string;category:VehicleCategory;declaredType:string;
  current:PolicyRecord|null;history:PolicyRecord[];totalPremium:number;
};
type Option={value:string;label:string;category:VehicleCategory};
// Both export shapes share these keys; a row is one spreadsheet line in either view.
type ExportRow=Record<string,string|number>;

const peso=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"});
const readable=(value:string)=>value?new Date(`${value}T00:00:00`).toLocaleDateString("en-PH"):"—";
const stateLabel={EXPIRED:"Expired",EXPIRING:"Expiring soon",ACTIVE:"Active"} as const;
const matches=(item:PolicyRecord,term:string)=>
  [item.vehicle,item.insurer,item.policyNumber,item.registeredOwner,item.assignedDriver].some(field=>field.toLowerCase().includes(term));

export function InsuranceTable({records,histories,vehicles,canManage,canDelete}:{
  records:PolicyRecord[];histories:VehicleHistory[];vehicles:Option[];canManage:boolean;canDelete:boolean;
}){
  const [search,setSearch]=useState("");
  const [tab,setTab]=useState<"policies"|"vehicles">("policies");
  const [attentionOnly,setAttentionOnly]=useState(false);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [editing,setEditing]=useState<PolicyRecord|null|undefined>(undefined);
  const [presetVehicle,setPresetVehicle]=useState("");
  const [deleting,setDeleting]=useState<PolicyRecord|null>(null);
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();

  const term=search.trim().toLowerCase();
  const needsAttention=records.filter(item=>item.state!=="ACTIVE").length;
  const uninsured=histories.filter(item=>!item.current).length;

  const visible=useMemo(()=>records
    .filter(item=>!attentionOnly||item.state!=="ACTIVE")
    .filter(item=>!term||matches(item,term)),[records,term,attentionOnly]);

  const groups=useMemo(()=>{
    const kept=histories
      .filter(item=>!attentionOnly||!item.current||item.current.state!=="ACTIVE")
      .filter(item=>!term||item.vehicle.toLowerCase().includes(term)||item.current&&matches(item.current,term)||item.history.some(policy=>matches(policy,term)));
    const map=new Map<VehicleCategory,VehicleHistory[]>();
    for(const item of kept)map.set(item.category,[...(map.get(item.category)??[]),item]);
    return [...map.entries()];
  },[histories,term,attentionOnly]);

  function openNew(vehicleId=""){setError("");setPresetVehicle(vehicleId);setEditing(null)}
  function save(data:FormData){
    setError("");
    startTransition(async()=>{
      const result=await saveInsurancePolicy(editing?.id??null,data);
      if(result.ok){setEditing(undefined);setPresetVehicle("")}else setError(result.error);
    });
  }
  function remove(){
    if(!deleting)return;
    const input=document.getElementById("insurance-delete-confirmation") as HTMLInputElement;
    startTransition(async()=>{
      const result=await deleteInsurancePolicy(deleting.id,input.value);
      if(result.ok)setDeleting(null);else setError(result.error);
    });
  }
  function download(){
    const rows=tab==="policies"
      ?visible.map((item,index)=>({
        "No.":index+1,Category:item.category,Vehicle:item.vehicle,Insurer:item.insurer,
        "Policy number":item.policyNumber||"",Start:readable(item.policyStart),End:readable(item.policyEnd),
        "Days remaining":item.daysRemaining,Premium:item.premium?Number(item.premium):"",
        Status:stateLabel[item.state],Remarks:item.remarks||"",
      }))
      :groups.flatMap(([category,items])=>items.flatMap<ExportRow>(item=>{
        const all=[...(item.current?[item.current]:[]),...item.history];
        if(!all.length)return [{Category:category,Vehicle:item.vehicle,Cover:"None recorded",Insurer:"",
          "Policy number":"",Start:"",End:"",Premium:"",Status:"Uninsured"}];
        return all.map((policy,index)=>({
          Category:category,Vehicle:item.vehicle,Cover:index===0?"Current":`History ${index}`,
          Insurer:policy.insurer,"Policy number":policy.policyNumber||"",
          Start:readable(policy.policyStart),End:readable(policy.policyEnd),
          Premium:policy.premium?Number(policy.premium):"",Status:stateLabel[policy.state],
        }));
      }));
    const workbook=XLSX.utils.book_new(),sheet=XLSX.utils.json_to_sheet(rows);
    sheet["!cols"]=Object.keys(rows[0]??{}).map(key=>({wch:Math.max(13,key.length+4)}));
    XLSX.utils.book_append_sheet(workbook,sheet,tab==="policies"?"Policies":"By vehicle");
    XLSX.writeFile(workbook,`insurance-${tab}-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return <>
    <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold m-0">Insurance monitoring</h1>
        <p className="text-slate-500">Policy expiry, renewal history and cover by asset.</p>
      </div>
      {canManage&&<button className="btn no-print" onClick={()=>openNew()}>Add policy</button>}
    </div>

    <nav className="settings-tabs no-print">
      <button className={`settings-tab${tab==="policies"?" is-active":""}`} onClick={()=>setTab("policies")}>All policies ({records.length})</button>
      <button className={`settings-tab${tab==="vehicles"?" is-active":""}`} onClick={()=>setTab("vehicles")}>By vehicle ({histories.length})</button>
    </nav>

    <div className="card management-tools no-print">
      <label className="management-search">Search
        <input className="field" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search vehicle, insurer, policy number…" autoComplete="off"/>
      </label>
      <button className={`btn secondary${attentionOnly?" is-active-filter":""}`} onClick={()=>setAttentionOnly(!attentionOnly)}>
        {attentionOnly?"Showing needs attention":`Needs attention (${needsAttention})`}
      </button>
      <span>{uninsured} without cover</span>
      <button className="btn secondary" onClick={()=>window.print()}>Print</button>
      <button className="btn secondary" onClick={download}>Download Excel</button>
    </div>

    {tab==="policies"&&<div className="card desktop-table management-print">
      <table className="table">
        <thead><tr>
          <th>No.</th><th>Vehicle</th><th>Category</th><th>Insurer</th><th>Policy</th><th>Start</th><th>End</th>
          <th>Days left</th><th>Premium</th><th>Status</th>{canManage&&<th className="no-print">Actions</th>}
        </tr></thead>
        <tbody>{visible.map((item,index)=><tr key={item.id}>
          <td>{index+1}</td>
          <td>{item.vehicle}</td>
          <td><span className="asset-tag">{item.category}</span></td>
          <td>{item.insurer}</td>
          <td>{item.policyNumber||"—"}</td>
          <td>{readable(item.policyStart)}</td>
          <td>{readable(item.policyEnd)}</td>
          <td>{item.state==="EXPIRED"?`${Math.abs(item.daysRemaining)} overdue`:item.daysRemaining}</td>
          <td>{item.premium?peso.format(Number(item.premium)):"—"}</td>
          <td><span className={`policy-state is-${item.state.toLowerCase()}`}>{stateLabel[item.state]}</span></td>
          {canManage&&<td className="no-print"><div className="flex gap-1">
            <button className="btn secondary" onClick={()=>{setError("");setEditing(item)}}>Edit</button>
            {canDelete&&<button className="btn danger" onClick={()=>{setError("");setDeleting(item)}}>Delete</button>}
          </div></td>}
        </tr>)}</tbody>
      </table>
      {!visible.length&&<p className="p-8 text-center text-slate-500">{records.length?"No policies match this search.":"No policies recorded yet. Select Add policy to create the first one."}</p>}
    </div>}

    {tab==="vehicles"&&<div className="grid gap-6 management-print">
      {groups.map(([category,items])=><section key={category}>
        <div className="asset-group-heading">
          <h2 className="text-lg font-bold m-0">{category}</h2>
          <span className="text-sm text-slate-500">{items.length} asset{items.length===1?"":"s"}</span>
        </div>
        <div className="grid gap-3">{items.map(item=>{
          const open=expanded[item.vehicleId];
          return <article className="card policy-card" key={item.vehicleId}>
            <div className="policy-card-head">
              <div>
                <strong>{item.vehicle}</strong>
                <p className="text-sm text-slate-500 m-0">
                  {item.declaredType?`Type: ${item.declaredType}`:"Type not set — category inferred from the name"}
                  {item.totalPremium>0&&` · ${peso.format(item.totalPremium)} total premium on record`}
                </p>
              </div>
              <div className="flex gap-1 no-print">
                {item.history.length>0&&<button className="btn secondary" onClick={()=>setExpanded({...expanded,[item.vehicleId]:!open})}>
                  {open?"Hide history":`History (${item.history.length})`}
                </button>}
                {canManage&&<button className="btn secondary" onClick={()=>openNew(item.vehicleId)}>Add policy</button>}
              </div>
            </div>

            {item.current?<div className="policy-current">
              <div>
                <span className={`policy-state is-${item.current.state.toLowerCase()}`}>{stateLabel[item.current.state]}</span>
                <strong className="ml-2">{item.current.insurer}</strong>
                {item.current.policyNumber&&<span className="text-slate-500"> · {item.current.policyNumber}</span>}
              </div>
              <div className="text-sm text-slate-500">
                {readable(item.current.policyStart)} – {readable(item.current.policyEnd)}
                {item.current.state==="EXPIRED"
                  ?` · ${Math.abs(item.current.daysRemaining)} days overdue`
                  : ` · ${item.current.daysRemaining} days left`}
                {item.current.premium&&` · ${peso.format(Number(item.current.premium))}`}
              </div>
              {canManage&&<div className="flex gap-1 no-print">
                <button className="btn secondary" onClick={()=>{setError("");setEditing(item.current!)}}>Edit</button>
                {canDelete&&<button className="btn danger" onClick={()=>{setError("");setDeleting(item.current!)}}>Delete</button>}
              </div>}
            </div>:<p className="policy-empty">No policy recorded for this asset.</p>}

            {open&&item.history.length>0&&<table className="table policy-history">
              <thead><tr><th>Insurer</th><th>Policy</th><th>Start</th><th>End</th><th>Premium</th><th>Status</th>{canManage&&<th className="no-print">Actions</th>}</tr></thead>
              <tbody>{item.history.map(policy=><tr key={policy.id}>
                <td>{policy.insurer}</td>
                <td>{policy.policyNumber||"—"}</td>
                <td>{readable(policy.policyStart)}</td>
                <td>{readable(policy.policyEnd)}</td>
                <td>{policy.premium?peso.format(Number(policy.premium)):"—"}</td>
                <td><span className={`policy-state is-${policy.state.toLowerCase()}`}>{stateLabel[policy.state]}</span></td>
                {canManage&&<td className="no-print"><div className="flex gap-1">
                  <button className="btn secondary" onClick={()=>{setError("");setEditing(policy)}}>Edit</button>
                  {canDelete&&<button className="btn danger" onClick={()=>{setError("");setDeleting(policy)}}>Delete</button>}
                </div></td>}
              </tr>)}</tbody>
            </table>}
          </article>;
        })}</div>
      </section>)}
      {!groups.length&&<p className="card p-8 text-center text-slate-500">No assets match this search.</p>}
    </div>}

    {canManage&&editing!==undefined&&<div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div><h2>{editing?"Edit policy":"Add policy"}</h2><p>Complete the fields below, then save your changes.</p></div>
          <button className="modal-close" onClick={()=>{setEditing(undefined);setPresetVehicle("")}}>&times;</button>
        </div>
        <form action={save} className="edit-grid">
          {error&&<p className="form-error edit-wide">{error}</p>}
          <label className="edit-wide">Vehicle
            <select className="field" name="vehicleId" defaultValue={editing?.vehicleId??presetVehicle} required>
              <option value="">Select a vehicle</option>
              {vehicles.map(option=><option key={option.value} value={option.value}>{option.label} — {option.category}</option>)}
            </select>
          </label>
          <label>Insurer<input className="field" name="insurer" defaultValue={editing?.insurer??""} required/></label>
          <label>Policy number<input className="field" name="policyNumber" defaultValue={editing?.policyNumber??""}/></label>
          <label>Policy start<input className="field" name="policyStart" type="date" defaultValue={editing?.policyStart??""} required/></label>
          <label>Policy end<input className="field" name="policyEnd" type="date" defaultValue={editing?.policyEnd??""} required/></label>
          <label>Premium (PHP)<input className="field" name="premium" type="number" step="0.01" min="0" defaultValue={editing?.premium??""}/></label>
          <label>Status
            <select className="field" name="status" defaultValue={editing?.status??"ACTIVE"}>
              {["ACTIVE","PENDING","EXPIRED","CANCELLED"].map(option=><option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>Registered owner<input className="field" name="registeredOwner" defaultValue={editing?.registeredOwner??""}/></label>
          <label>Assigned driver<input className="field" name="assignedDriver" defaultValue={editing?.assignedDriver??""}/></label>
          <label className="edit-wide">Remarks<textarea className="field" name="remarks" defaultValue={editing?.remarks??""}/></label>
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={()=>{setEditing(undefined);setPresetVehicle("")}}>Cancel</button>
            <button className="btn" disabled={pending}>{pending?"Saving…":"Save policy"}</button>
          </div>
        </form>
      </section>
    </div>}

    {canDelete&&deleting&&<div className="modal-backdrop">
      <section className="modal-card delete-card" role="dialog" aria-modal="true">
        <div className="modal-heading"><div><h2>Delete policy</h2><p>{deleting.insurer} · {deleting.vehicle}. This cannot be undone.</p></div></div>
        <div className="delete-body">
          {error&&<p className="form-error">{error}</p>}
          <label>Type <strong>DELETE</strong> to confirm<input id="insurance-delete-confirmation" className="field" autoComplete="off"/></label>
          <div className="modal-actions">
            <button className="btn secondary" onClick={()=>setDeleting(null)}>Cancel</button>
            <button className="btn danger" disabled={pending} onClick={remove}>{pending?"Deleting…":"Delete permanently"}</button>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
