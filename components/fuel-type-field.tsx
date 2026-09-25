"use client";
import {useEffect,useState} from "react";
import {FUEL_TYPES} from "@/lib/fuel-consumption";

const OTHERS="Others";
const split=(value:string)=>!value?{choice:"",other:""}:(FUEL_TYPES as readonly string[]).includes(value)?{choice:value,other:""}:{choice:OTHERS,other:value};

// Diesel or Gasoline come from the dropdown; anything else is typed in after picking
// "Others". Only the resolved name is submitted, as the single `fuelType` field.
// `suggested` (the selected vehicle's fuel type) fills the field until the user picks one.
export function FuelTypeField({initial="",suggested="",required=false}:{initial?:string;suggested?:string;required?:boolean}){
  const [state,setState]=useState(()=>split(initial)),[touched,setTouched]=useState(Boolean(initial));
  useEffect(()=>{if(!touched)setState(split(suggested))},[suggested,touched]);
  const value=state.choice===OTHERS?state.other.trim():state.choice;
  return <>
    <label>Fuel type<select className="field" value={state.choice} required={required} onChange={event=>{setTouched(true);setState({choice:event.target.value,other:""})}}>
      <option value="">Select</option>{FUEL_TYPES.map(fuel=><option key={fuel}>{fuel}</option>)}<option>{OTHERS}</option>
    </select></label>
    {state.choice===OTHERS&&<label>Specify fuel type<input className="field" value={state.other} required maxLength={40} placeholder="e.g. Kerosene, LPG" onChange={event=>{setTouched(true);setState({choice:OTHERS,other:event.target.value})}}/></label>}
    <input type="hidden" name="fuelType" value={value}/>
  </>;
}
