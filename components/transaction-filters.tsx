"use client";

import {useRouter} from "next/navigation";
import {useEffect,useMemo,useState} from "react";

type Option={value:string;label:string};
type Props={initial:{q:string;status:string;company:string;vehicle:string;operator:string;from:string;to:string;period:string;sort:string;dir:string};companies:Option[];vehicles:Option[];operators:Option[]};

const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
// Presets resolve to real dates when the filter is submitted, so the range stays fixed in the
// URL that gets shared, printed or exported rather than shifting with the calendar.
const periodRange=(period:string,today=new Date()):{from:string;to:string}=>{
  const year=today.getFullYear(),month=today.getMonth();
  switch(period){
    case "this-month":return {from:iso(new Date(year,month,1)),to:iso(new Date(year,month+1,0))};
    case "last-month":return {from:iso(new Date(year,month-1,1)),to:iso(new Date(year,month,0))};
    case "this-year":return {from:iso(new Date(year,0,1)),to:iso(new Date(year,11,31))};
    case "last-year":return {from:iso(new Date(year-1,0,1)),to:iso(new Date(year-1,11,31))};
    default:return {from:"",to:""};
  }
};
const periodOptions=[["","All dates"],["this-month","This month"],["last-month","Last month"],["this-year","This year"],["last-year","Last year"],["custom","Custom date"]] as const;

export function TransactionFilters({initial,companies,vehicles,operators}:Props){
  const router=useRouter();
  const [search,setSearch]=useState(initial.q);
  const [open,setOpen]=useState(false);
  const [period,setPeriod]=useState(initial.period||(initial.from||initial.to?"custom":""));
  const [range,setRange]=useState({from:initial.from,to:initial.to});
  const custom=period==="custom";
  const suggestions=useMemo(()=>{
    const needle=search.trim().toLowerCase();
    if(needle.length<2)return [];
    return [...vehicles.map(item=>({...item,type:"Vehicle"})),...operators.map(item=>({...item,type:"Operator"}))]
      .filter(item=>item.label.toLowerCase().includes(needle)).slice(0,8);
  },[search,vehicles,operators]);
  useEffect(()=>setOpen(suggestions.length>0),[suggestions]);
  const exportUrl=()=>{const form=document.getElementById("transaction-filter-form") as HTMLFormElement;return `/api/transactions/export?${new URLSearchParams(new FormData(form) as never).toString()}`};
  return <form id="transaction-filter-form" className="card filter-grid mb-5" onSubmit={()=>setOpen(false)}>
    {initial.sort&&<input type="hidden" name="sort" value={initial.sort}/>}{initial.dir&&<input type="hidden" name="dir" value={initial.dir}/>}
    <div className="autocomplete"><label>Search<input className="field" name="q" placeholder="P.O., invoice, vehicle or operator" value={search} onChange={event=>setSearch(event.target.value)} onFocus={()=>setOpen(suggestions.length>0)} autoComplete="off"/></label>{open&&<div className="suggestions">{suggestions.map(item=><button type="button" key={`${item.type}-${item.value}`} onClick={()=>{setSearch(item.label);setOpen(false)}}><small>{item.type}</small>{item.label}</button>)}</div>}</div>
    <label>Company<select className="field" name="company" defaultValue={initial.company}><option value="">All companies</option>{companies.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Vehicle<select className="field" name="vehicle" defaultValue={initial.vehicle}><option value="">All vehicles</option>{vehicles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Driver / operator<select className="field" name="operator" defaultValue={initial.operator}><option value="">All operators</option>{operators.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Date range<select className="field" name="period" value={period} onChange={event=>{
      const next=event.target.value;setPeriod(next);
      if(next!=="custom")setRange(periodRange(next));
    }}>{periodOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {custom
      ?<><label>From<input className="field" type="date" name="from" value={range.from} onChange={event=>setRange(state=>({...state,from:event.target.value}))}/></label>
        <label>To<input className="field" type="date" name="to" value={range.to} onChange={event=>setRange(state=>({...state,to:event.target.value}))}/></label></>
      :<><input type="hidden" name="from" value={range.from}/><input type="hidden" name="to" value={range.to}/></>}
    <label>Status<select className="field" name="status" defaultValue={initial.status}><option value="">All statuses</option>{["DRAFT","SUBMITTED","APPROVED","REJECTED","LOCKED"].map(status=><option key={status}>{status}</option>)}</select></label>
    <div className="filter-actions"><button className="btn">Filter</button><button className="btn secondary" type="button" onClick={()=>router.push("/transactions")}>Clear</button><button className="btn secondary" type="button" onClick={()=>window.print()}>Print</button><button className="btn secondary" type="button" onClick={()=>window.location.href=exportUrl()}>Download Excel</button></div>
  </form>;
}
