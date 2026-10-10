import assert from "node:assert/strict";
import test from "node:test";
import { pushCommands, pullChanges } from "../src/command-sync.ts";
import { materializedSnapshot } from "../src/index.ts";
import { commandRequest, fakeD1, seedBaseline } from "./support/d1-harness.mjs";

const cashier={email:"kasir@cuciin.id",name:"Synthetic cashier",role:"Kasir",branchIds:["melati"],bootstrap:false};
const payload={id:"legacy-1",branchId:"melati",cashierName:"untrusted",cashierEmail:"untrusted@example.test",customerName:"Synthetic customer",phone:"",paid:0,paymentStatus:"Belum",paymentMethod:"Tunai",workStatus:"Masuk",createdAt:123,estimatedFinish:"Synthetic pickup",waSent:false,lines:[{serviceId:"cuci",serviceName:"Cuci",quantity:2,unit:"kg",unitPrice:10000}]};

test("historical order journal also reads as canonical Nota without rewriting history",async()=>{
  const env=fakeD1();seedBaseline(env);
  const historical={...payload,cashierEmail:cashier.email,cashierName:cashier.name,total:20000,updatedAt:42};
  env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id) VALUES('cuciin','order','legacy-1','upsert',?,42,'melati')").run(JSON.stringify(historical));
  const pulled=await (await pullChanges(new Request("https://synthetic.test/v1/sync/changes"),env,cashier)).json();
  assert.equal(pulled.changes[0].entityType,"nota");
  assert.equal(pulled.changes[0].payload.kasir,cashier.name);
  assert.equal(pulled.changes[0].payload.createdAt,"123");
  assert.equal(pulled.changes[0].payload.lines[0].qty,2);
  const snapshot=(await materializedSnapshot(env)).snapshot;
  assert.equal(snapshot.notas[0].kasir,cashier.name);
  assert.equal(snapshot.notas[0].customer,"Synthetic customer");
  assert.equal(snapshot.notas[0].items,"Cuci");
  assert.equal(snapshot.notas[0].updatedAtMs,42);
  assert.equal(env.db.prepare("SELECT entity_type FROM sync_changes").get().entity_type,"order");
  env.db.close();
});

test("legacy order.put emits canonical nota for Kotlin snapshot and pull",async()=>{
  const env=fakeD1();seedBaseline(env);
  env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
  const sent=await (await pushCommands(commandRequest([{commandId:"legacy-create-0001",type:"order.put",entityId:"legacy-1",branchId:"melati",payload}]),env,cashier)).json();
  assert.equal(sent.results[0].accepted,true,JSON.stringify(sent));
  const pulled=await (await pullChanges(new Request("https://synthetic.test/v1/sync/changes?since=0"),env,cashier)).json();
  const journal=pulled.changes.find(c=>c.entityId==="legacy-1");
  assert.equal(journal.entityType,"nota","Android does not understand order alias");
  const nota=journal.payload;
  const expected={id:"legacy-1",branchId:"melati",kasir:"Synthetic cashier",kasirEmail:cashier.email,customer:"Synthetic customer",phone:"",items:"Cuci",total:20000,paid:0,pay:"Belum",laundry:"Masuk",createdAt:"123",createdAtMs:123,pickupAt:"Synthetic pickup",waSent:false,payMethod:"Tunai",photos:[],lines:[{serviceId:"cuci",name:"Cuci",qty:2,unit:"kg",unitPrice:10000,handledByEmail:cashier.email,handledByName:cashier.name,commissionPerUnit:1000,productKey:""}]};
  for(const [key,value] of Object.entries(expected)) {
    if(key==="lines") for(const [field,entry] of Object.entries(value[0])) assert.deepEqual(nota.lines[0][field],entry,`Kotlin line ${field}`);
    else assert.deepEqual(nota[key],value,`Kotlin field ${key}`);
  }
  assert.equal(nota.cashierEmail,cashier.email,"legacy alias retains authoritative actor");
  assert.equal(nota.lines[0].quantity,2,"legacy line alias retained");
  assert.equal(typeof nota.updatedAtMs,"number");
  assert.equal(nota.canceledAtMs,0);
  assert.deepEqual((await materializedSnapshot(env)).snapshot.notas,[nota]);
  const stored=JSON.parse(env.db.prepare("SELECT payload_json FROM orders").get().payload_json);
  assert.deepEqual(stored,nota);
  env.db.close();
});
