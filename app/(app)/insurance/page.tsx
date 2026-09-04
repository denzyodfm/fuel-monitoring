import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {vehicleLabel} from "@/lib/format";
import {categoryOrder,vehicleCategory} from "@/lib/vehicle-category";
import {InsuranceTable,type PolicyRecord,type VehicleHistory} from "@/components/insurance-table";

const DAY=86_400_000;
// The dashboard counts an "insurance alert" as a policy ending within 90 days and not
// yet past. Keep this page on the same window so the two never disagree.
const WARNING_DAYS=90;
const isoDate=(value:Date)=>value.toISOString().slice(0,10);

export default async function Page(){
  const session=await requireSession();
  const [policies,vehicles]=await Promise.all([
    db.insurancePolicy.findMany({where:{vehicle:{organizationId:session.organizationId}},include:{vehicle:true},orderBy:{policyEnd:"desc"}}),
    db.vehicle.findMany({where:{organizationId:session.organizationId},orderBy:{plateNumber:"asc"}}),
  ]);
  const midnight=new Date();midnight.setHours(0,0,0,0);

  const records:PolicyRecord[]=policies.map(policy=>{
    const daysRemaining=Math.round((policy.policyEnd.getTime()-midnight.getTime())/DAY);
    return {
      id:policy.id,
      vehicleId:policy.vehicleId,
      vehicle:vehicleLabel(policy.vehicle.plateNumber,policy.vehicle.assetName),
      category:vehicleCategory(policy.vehicle.plateNumber,policy.vehicle.assetName,policy.vehicle.vehicleType),
      insurer:policy.insurer,
      policyNumber:policy.policyNumber??"",
      policyStart:isoDate(policy.policyStart),
      policyEnd:isoDate(policy.policyEnd),
      premium:policy.premium?.toString()??"",
      registeredOwner:policy.registeredOwner??"",
      assignedDriver:policy.assignedDriver??"",
      status:policy.status,
      remarks:policy.remarks??"",
      daysRemaining,
      state:daysRemaining<0?"EXPIRED":daysRemaining<=WARNING_DAYS?"EXPIRING":"ACTIVE",
    };
  });

  // Every asset gets an entry, including those never insured -- an uninsured generator is
  // exactly the thing this page should surface. Policies run newest first, so the head of
  // the list is the current cover and the tail is the history behind it.
  const byVehicle=new Map<string,PolicyRecord[]>();
  for(const record of records)byVehicle.set(record.vehicleId,[...(byVehicle.get(record.vehicleId)??[]),record]);
  const histories:VehicleHistory[]=vehicles.map(vehicle=>{
    const label=vehicleLabel(vehicle.plateNumber,vehicle.assetName);
    const own=byVehicle.get(vehicle.id)??[];
    return {
      vehicleId:vehicle.id,
      vehicle:label,
      category:vehicleCategory(vehicle.plateNumber,vehicle.assetName,vehicle.vehicleType),
      declaredType:vehicle.vehicleType??"",
      current:own[0]??null,
      history:own.slice(1),
      totalPremium:own.reduce((sum,item)=>sum+Number(item.premium||0),0),
    };
  }).sort((a,b)=>categoryOrder(a.category)-categoryOrder(b.category)||a.vehicle.localeCompare(b.vehicle));

  return <InsuranceTable
    records={[...records].sort((a,b)=>a.policyEnd.localeCompare(b.policyEnd))}
    histories={histories}
    vehicles={vehicles.map(vehicle=>({
      value:vehicle.id,
      label:vehicleLabel(vehicle.plateNumber,vehicle.assetName),
      category:vehicleCategory(vehicle.plateNumber,vehicle.assetName,vehicle.vehicleType),
    }))}
    canManage={session.role==="ADMINISTRATOR"||session.role==="STAFF"}
    canDelete={session.role==="ADMINISTRATOR"}
  />;
}
