"use client";

import {useRouter} from "next/navigation";
import {useEffect,useMemo,useState} from "react";

type Option={value:string;label:string};
type Props={initial:{q:string;status:string;vehicle:string;operator:string;from:string;to:string};vehicles:Option[];operators:Option[]};

export function TransactionFilters({initial,vehicles,operators}:Props){
  const router=useRouter();
  const [search,setSearch]=useState(initial.q);
  const [open,setOpen]=useState(false);
  const suggestions=useMemo(()=>{
    const needle=search.trim().toLowerCase();
    if(needle.length<2)return [];
    return [...vehicles.map(item=>({...item,type:"Vehicle"})),...operators.map(item=>({...item,type:"Operator"}))]
      .filter(item=>item.label.toLowerCase().includes(needle)).slice(0,8);
  },[search,vehicles,operators]);
  useEffect(()=>setOpen(suggestions.length>0),[suggestions]);
  const exportUrl=()=>{const form=document.getElementById("transaction-filter-form") as HTMLFormElement;return `/api/transactions/export?${new URLSearchParams(new FormData(form) as never).toString()}`};
  return <form id="transaction-filter-form" className="card filter-grid mb-5" onSubmit={()=>setOpen(false)}>
    <div className="autocomplete"><label>Search<input className="field" name="q" placeholder="P.O., invoice, vehicle or operator" value={search} onChange={event=>setSearch(event.target.value)} onFocus={()=>setOpen(suggestions.length>0)} autoComplete="off"/></label>{open&&<div className="suggestions">{suggestions.map(item=><button type="button" key={`${item.type}-${item.value}`} onClick={()=>{setSearch(item.label);setOpen(false)}}><small>{item.type}</small>{item.label}</button>)}</div>}</div>
    <label>Vehicle<select className="field" name="vehicle" defaultValue={initial.vehicle}><option value="">All vehicles</option>{vehicles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Driver / operator<select className="field" name="operator" defaultValue={initial.operator}><option value="">All operators</option>{operators.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>From<input className="field" type="date" name="from" defaultValue={initial.from}/></label>
    <label>To<input className="field" type="date" name="to" defaultValue={initial.to}/></label>
    <label>Status<select className="field" name="status" defaultValue={initial.status}><option value="">All statuses</option>{["DRAFT","SUBMITTED","APPROVED","REJECTED","LOCKED"].map(status=><option key={status}>{status}</option>)}</select></label>
    <div className="filter-actions"><button className="btn">Filter</button><button className="btn secondary" type="button" onClick={()=>router.push("/transactions")}>Clear</button><button className="btn secondary" type="button" onClick={()=>window.print()}>Print</button><button className="btn secondary" type="button" onClick={()=>window.location.href=exportUrl()}>Download Excel</button></div>
  </form>;
}
