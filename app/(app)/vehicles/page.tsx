import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {vehicleLabel} from "@/lib/format";
import {vehicleCategory} from "@/lib/vehicle-category";
import {suggestDuplicates} from "@/lib/vehicle-duplicates";
import {ManagementTable} from "@/components/management-table";
import {VehicleMerge} from "@/components/vehicle-merge";

export default async function Page(){
  const session=await requireSession();
  const [items,companies]=await Promise.all([
    db.vehicle.findMany({where:{organizationId:session.organizationId},include:{company:true,_count:{select:{transactions:true,policies:true,odometerLogs:true}}},orderBy:{plateNumber:"asc"}}),
    db.company.findMany({where:{organizationId:session.organizationId,active:true},orderBy:{code:"asc"}}),
  ]);
  const suggestions=suggestDuplicates(items.map(item=>({id:item.id,plateNumber:item.plateNumber,assetName:item.assetName})));
  return <>
    {session.role==="ADMINISTRATOR"&&<VehicleMerge
      candidates={items.map(item=>({
        id:item.id,
        label:vehicleLabel(item.plateNumber,item.assetName),
        transactions:item._count.transactions,
        policies:item._count.policies,
        odometerLogs:item._count.odometerLogs,
        company:item.company?.code??"",
        driver:item.assignedDriver??"",
      }))}
      groups={suggestions.map(item=>({key:item.key,ids:item.vehicleIds}))}
    />}
    <ManagementTable
      canManage={session.role!=="VIEWER"}
      kind="vehicle"
      title="Vehicle management"
      description="Manage fleet assets and assign them to companies."
      headers={["Vehicle","Category","Company","Type","Driver","Fuel records","Status"]}
      companies={companies.map(item=>({value:item.id,label:`${item.code} — ${item.name}`}))}
      records={items.map(item=>({
        id:item.id,
        Vehicle:vehicleLabel(item.plateNumber,item.assetName),
        Category:vehicleCategory(item.plateNumber,item.assetName,item.vehicleType),
        Company:item.company?.code??"—",
        Type:item.vehicleType??"—",
        Driver:item.assignedDriver??"—",
        "Fuel records":item._count.transactions,
        Status:item.status,
        plateNumber:item.plateNumber,
        assetName:item.assetName??"",
        companyId:item.companyId??"",
        vehicleType:item.vehicleType??"",
        make:item.make??"",
        model:item.model??"",
        color:item.color??"",
        assignedDriver:item.assignedDriver??"",
        fuelType:item.fuelType??"",
        odometerRequired:item.odometerRequired,
        status:item.status,
        remarks:item.remarks??"",
      }))}
    />
  </>;
}
