import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {PageHeading} from "@/components/page-heading";
import {importSuppliedWorkbook,importWorkbook} from "./actions";

export default async function Imports({searchParams}:{searchParams:Promise<{error?:string}>}){
  const session=await requireSession(["ADMINISTRATOR"]);
  const query=await searchParams;
  const canImport=true;
  const batches=await db.importBatch.findMany({where:{organizationId:session.organizationId},include:{uploadedBy:true},orderBy:{createdAt:"desc"},take:20});
  return <>
    <PageHeading title="Excel imports" description="Idempotent detail-sheet imports with source lineage and reconciliation."/>
    {canImport&&<form action={importSuppliedWorkbook} className="card mb-5 flex flex-wrap items-center gap-4">
      <div className="grow"><strong>Supplied Fuel Monitoring workbook</strong><p className="text-sm text-slate-500 m-0">Already on this computer—no Edge file picker required.</p></div>
      <button className="btn">Import supplied workbook</button>
    </form>}
    {canImport&&<form action={importWorkbook} className="card mb-6 flex flex-wrap items-end gap-4">
      <label className="grow">Choose a different workbook (.xlsx)<input className="field mt-1" name="workbook" type="file" accept=".xlsx,.xls" required/></label>
      <label className="flex gap-2 items-center p-3"><input type="checkbox" name="dryRun"/> Dry run only</label>
      <button className="btn">Analyze and import</button>
      {query.error&&<p className="w-full text-red-700">{query.error}</p>}
      <p className="w-full text-sm text-slate-500">Semi-monthly detail sheets are authoritative. Monthly sheets are reconciliation-only and never imported as transactions.</p>
    </form>}
    <div className="card desktop-table"><table className="table"><thead><tr><th>Workbook</th><th>Status</th><th>Rows</th><th>Imported</th><th>Rejected</th><th>Uploaded</th></tr></thead><tbody>{batches.map(batch=><tr key={batch.id}><td>{batch.filename}<small className="block text-slate-500">{batch.checksum.slice(0,12)}…</small></td><td><span className="badge">{batch.status}</span></td><td>{batch.totalRows}</td><td>{batch.importedRows}</td><td>{batch.rejectedRows}</td><td>{batch.createdAt.toLocaleString("en-PH")}</td></tr>)}</tbody></table>{!batches.length&&<p className="text-slate-500 p-6 text-center">No import batches yet.</p>}</div>
  </>;
}
