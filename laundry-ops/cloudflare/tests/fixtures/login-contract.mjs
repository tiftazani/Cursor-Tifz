import { compactAccessSnapshot } from "../../src/index.ts";
import { pushCommands, pullChanges } from "../../src/command-sync.ts";
import { fakeD1, seedBaseline, commandRequest } from "../support/d1-harness.mjs";

export async function loginContract() {
  const env=fakeD1();seedBaseline(env);
  env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('contract-service','cuciin','Cuci','kg',10000,1000,1)");
  env.db.exec("INSERT INTO access_roles VALUES('role-kasir','cuciin','Kasir',1,'{\"modules\":[\"service\"],\"functions\":[\"service.create\"]}',1)");
  env.db.exec("UPDATE staff SET access_role_id='role-kasir' WHERE email='kasir@cuciin.id'");
  env.db.exec("INSERT INTO access_policies VALUES('kasir@cuciin.id','cuciin','{\"modules\":[\"service\"],\"functions\":[\"service.create\"]}',1)");
  env.db.exec("DELETE FROM staff WHERE email!='kasir@cuciin.id'");
  env.db.exec("DELETE FROM staff_branches WHERE staff_email!='kasir@cuciin.id'");
  env.db.exec("DELETE FROM branches WHERE id!='melati'");
  env.db.exec("UPDATE staff SET name='Kasir contoh' WHERE email='kasir@cuciin.id'");
  try {
    const identity={email:"kasir@cuciin.id",name:"Kasir contoh",role:"Kasir",branchIds:["melati"],bootstrap:false};
    const access=await compactAccessSnapshot(env,identity.email);
    access.updatedAt=1;
    const result=await (await pushCommands(commandRequest([{commandId:"contract-legacy-create",type:"order.put",entityId:"contract-1",branchId:"melati",payload:{id:"contract-1",branchId:"melati",cashierName:identity.name,customerName:"Data contoh",phone:"",paid:0,paymentStatus:"Belum",paymentMethod:"Tunai",workStatus:"Masuk",createdAt:123,estimatedFinish:"",waSent:false,lines:[{serviceId:"contract-service",serviceName:"Cuci",quantity:2,unit:"kg",unitPrice:10000}]}}]),env,identity)).json();
    if(!result.results[0].accepted) throw Error(JSON.stringify(result));
    const pulled=await (await pullChanges(new Request("https://synthetic.test/v1/sync/changes"),env,identity)).json();
    const nota=pulled.changes.find(row=>row.entityId==="contract-1").payload;
    nota.updatedAt=1;nota.updatedAtMs=1;
    return {identity:{email:identity.email,name:identity.name,role:identity.role,branchIds:identity.branchIds,access},nota};
  } finally {env.db.close();}
}
