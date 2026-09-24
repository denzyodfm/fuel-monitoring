"use client";

// Prints one report card on its own: every other card on the page is hidden while the
// print dialog is open (see .report-printing in globals.css).
export function ReportPrintButton({target}:{target:string}){
  function print(){
    const element=document.getElementById(target);if(!element)return;
    element.classList.add("is-print-target");document.body.classList.add("report-printing");
    window.addEventListener("afterprint",()=>{element.classList.remove("is-print-target");document.body.classList.remove("report-printing")},{once:true});
    window.print();
  }
  return <button type="button" className="btn secondary no-print" onClick={print}>Print</button>;
}
