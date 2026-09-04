// Not every asset in the fleet is a vehicle: the register also holds generators, engines,
// heavy equipment and properties. Nothing in the data marks which is which, so the category
// is derived. An explicit "Vehicle type" on the vehicle record always wins; the keyword
// rules below only fill the gap for records that never had one set.
export const CATEGORIES=["Vehicle","Generator","Engine","Equipment","Property","Other"] as const;
export type VehicleCategory=(typeof CATEGORIES)[number];

const RULES:[RegExp,VehicleCategory][]=[
  [/\b(GEN(SET|ERATOR)?|GPOWER|POWER\s*GEN)\b/,"Generator"],
  [/\b(ENGINE|MOTOR|OUTBOARD|MARINE|PUMP)\b/,"Engine"],
  [/\b(EQUIP(MENT)?|BACKHOE|LOADER|EXCAVATOR|FORKLIFT|BULLDOZER|CRANE|COMPRESSOR|WELDER|GRADER|ROLLER|MIXER|TRACTOR)\b/,"Equipment"],
  [/\b(PROPERTY|BUILDING|WAREHOUSE|OFFICE|LOT|FACILITY)\b/,"Property"],
];

// Makes and models seen in the fleet register. Some records carry no plate digits at all
// ("HILUX J - JPC", "HONDA ADV"), so the name is the only signal that they are vehicles.
const VEHICLE_WORDS=/\b(HILUX|FORTUNER|INNOVA|VIOS|TAMARAW|LAND\s*CRUISER|COASTER|HIACE|TOYOTA|MITSUBISHI|L200|STRADA|MONTERO|ADVENTURE|ISUZU|ELF|DMAX|D-MAX|CROSSWIND|HYUNDAI|BONGO|STAREX|KIA|CARNIVAL|SPORTAGE|NISSAN|NAVARA|URVAN|FORD|RANGER|EVEREST|SUZUKI|HONDA|ADV|CLICK|BEAT|YAMAHA|VEGA|MIO|SNIPER|MOTORBIKE|MOTORCYCLE|PICKUP|DUMP|TRUCK|VAN|SEDAN|SUV)\b/;

const TYPE_ALIASES:Record<string,VehicleCategory>={
  GENERATOR:"Generator",GENSET:"Generator",
  ENGINE:"Engine",MOTOR:"Engine",PUMP:"Engine",
  EQUIPMENT:"Equipment","HEAVY EQUIPMENT":"Equipment",
  PROPERTY:"Property",
  VEHICLE:"Vehicle",PICKUP:"Vehicle",TRUCK:"Vehicle",VAN:"Vehicle",CAR:"Vehicle",
  SUV:"Vehicle",MOTORCYCLE:"Vehicle",BUS:"Vehicle",TRAILER:"Vehicle",
};

export function vehicleCategory(plateNumber?:string|null,assetName?:string|null,vehicleType?:string|null):VehicleCategory{
  const declared=(vehicleType??"").trim().toUpperCase();
  if(declared){
    if(TYPE_ALIASES[declared])return TYPE_ALIASES[declared];
    for(const [pattern,category] of RULES)if(pattern.test(declared))return category;
    return "Vehicle";
  }
  const text=`${plateNumber??""} ${assetName??""}`.toUpperCase();
  for(const [pattern,category] of RULES)if(pattern.test(text))return category;
  if(VEHICLE_WORDS.test(text))return "Vehicle";
  // A plate number carries digits; a bare descriptive name usually does not.
  return /\d/.test(text)?"Vehicle":"Other";
}

export const categoryOrder=(category:VehicleCategory)=>CATEGORIES.indexOf(category);
