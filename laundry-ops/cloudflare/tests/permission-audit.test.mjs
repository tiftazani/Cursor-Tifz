import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pushCommands, pullChanges } from "../src/command-sync.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

let serial=0;
const wire=(entityType,entityId,payload,extra={})=>({commandId:`permission-audit-${++serial}`,entityType,entityId,operation:"upsert",branchId:payload?.branchId ?? null,payload,...extra});
const send=async(env,command,actor=identities.kasir)=>(await (await pushCommands(commandRequest([command]),env,actor)).json()).results[0];
function setup() { const env=fakeD1(); seedBaseline(env); return env; }
const nota=()=>({id:"MLT-audit",branchId:"melati",customer:"Pelanggan",phone:"0813",items:"Cuci",kasir:"Kasir Melati",kasirEmail:"kasir@cuciin.id",total:10000,paid:0,pay:"Belum",payMethod:"Tunai",laundry:"Masuk",createdAt:"1 Okt 2026, 08.00",createdAtMs:1,pickupAt:"",completedAt:null,pickedUpAt:null,waSent:false,waAt:null,dropOut:false,photos:[],canceledAtMs:0,canceledAt:"",canceledBy:"",cancelReason:"",lines:[{serviceId:"cuci",name:"Cuci",qty:1,unit:"kg",unitPrice:10000,handledByEmail:"kasir@cuciin.id",handledByName:"Kasir Melati",commissionPerUnit:1000}]});
async function create(env,p=nota()) {
  env.db.exec("INSERT OR IGNORE INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
  assert.equal((await send(env,wire("nota",p.id,p),identities.owner)).accepted,true);
  const stored=JSON.parse(rows(env,"SELECT payload_json FROM orders WHERE id=?",p.id)[0].payload_json);
  // Kotlin encodeDefaults restores productKey after Worker canonicalizes lines.
  return {...stored,lines:stored.lines.map(line=>({...line,productKey:line.productKey ?? ""}))};
}
const policy=(env,actor,modules,functions)=>env.db.prepare("INSERT OR REPLACE INTO access_policies(email,organization_id,payload_json,updated_at) VALUES(?,'cuciin',?,1)").run(actor.email,JSON.stringify({modules,functions}));

test("migration backfills only latest staff journal without reviving cleared assignment",()=>{
  const db=new DatabaseSync(":memory:"); const dir=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith(".sql") && f<"0010").sort()) db.exec(readFileSync(new URL(file,dir),"utf8"));
  db.exec("INSERT INTO organizations(id,name,owner_email,created_at,updated_at) VALUES('cuciin','Cuciin','owner@example.id',1,1)");
  const add=(email)=>db.prepare("INSERT INTO staff(email,organization_id,name,role,approved,updated_at) VALUES(?,'cuciin','Kasir','Kasir',1,1)").run(email);
  const log=(email,operation,payload)=>db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at) VALUES('cuciin','staff',?,?,?,1)").run(email,operation,payload);
  for(const email of ["latest@example.id","clear@example.id","delete@example.id","invalid@example.id"]) { add(email); log(email,"upsert",JSON.stringify({email,accessRoleId:"old"})); }
  log("latest@example.id","upsert",JSON.stringify({email:"latest@example.id",accessRoleId:"new-missing"}));
  add("forged@example.id");
  db.exec("INSERT INTO processed_commands(command_id,organization_id,processed_at,command_type,actor_email) VALUES('forged-command','cuciin',1,'customer.upsert','kasir@example.id')");
  db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,actor_email,command_id) VALUES('cuciin','staff','forged@example.id','upsert',?,1,'kasir@example.id','forged-command')").run(JSON.stringify({email:"forged@example.id",accessRoleId:"forged-role"}));
  log("clear@example.id","upsert",JSON.stringify({email:"clear@example.id"}));
  log("delete@example.id","delete",null);
  log("invalid@example.id","upsert","not json");
  db.exec(readFileSync(new URL("0010_staff_access_role.sql",dir),"utf8"));
  assert.deepEqual(db.prepare("SELECT email,access_role_id FROM staff ORDER BY email").all().map(r=>[r.email,r.access_role_id]),[["clear@example.id",""],["delete@example.id",""],["forged@example.id",""],["invalid@example.id",""],["latest@example.id","new-missing"]]);
  db.close();
});

test("explicit missing role denies and policy cannot widen empty role",async()=>{
  const env=setup();
  for(const accessRoleId of ["missing","empty"]) {
    if(accessRoleId==="empty") assert.equal((await send(env,wire("accessRole","empty",{id:"empty",name:"Kosong",modules:[],functions:[]}),identities.owner)).accepted,true);
    assert.equal((await send(env,wire("staff",identities.kasir.email,{email:identities.kasir.email,name:"Kasir",role:"Kasir",approved:true,branchIds:["melati"],accessRoleId}),identities.owner)).accepted,true);
    policy(env,identities.kasir,["customer"],["customer.write"]);
    assert.equal((await send(env,wire("customer","c-1",{name:"Pelanggan"}))).code,403);
  }
  assert.equal((await send(env,wire("customer","c-owner",{name:"Owner"}),identities.owner)).accepted,true);
});

test("operational change keeps branch cap and rejects canceled status",async()=>{
  const env=setup(); const p=await create(env,{...nota(),paid:10000,pay:"Lunas"});
  assert.equal((await send(env,wire("nota",p.id,{...p,syncIntent:"status",laundry:"Selesai"}),identities.kasirLain)).code,403);
  assert.equal((await send(env,wire("nota",p.id,{...p,syncIntent:"cancel"}),identities.owner)).accepted,true);
  const canceled=JSON.parse(rows(env,"SELECT payload_json FROM orders")[0].payload_json);
  assert.equal((await send(env,wire("nota",p.id,{...canceled,syncIntent:"status",laundry:"Selesai"}),identities.spv)).code,409);
});

test("P1 order.update cannot erase sent guard",async()=>{
  const env=setup(); const p=await create(env,{...nota(),waSent:true});
  assert.equal((await send(env,{commandId:`permission-audit-${++serial}`,type:"order.update",entityId:p.id,branchId:"melati",payload:{...p,waSent:false,customer:"Forged"}})).code,403);
  assert.equal(rows(env,"SELECT wa_sent FROM orders")[0].wa_sent,1);
});

test("P1 order.update cannot edit canceled nota",async()=>{
  const env=setup(); const p=await create(env,{...nota(),paid:10000,pay:"Lunas"});
  assert.equal((await send(env,wire("nota",p.id,{...p,syncIntent:"cancel",cancelReason:"Batal"}),identities.owner)).accepted,true);
  assert.equal((await send(env,{commandId:`permission-audit-${++serial}`,type:"order.update",entityId:p.id,branchId:"melati",payload:{...p,customer:"Forged"}},identities.owner)).code,409);
  assert.equal(rows(env,"SELECT customer_name FROM orders")[0].customer_name,"Pelanggan");
});

test("P1 Supervisor cannot write ledger payment",async()=>{
  const env=setup(); const p=await create(env,{...nota(),paid:10000,pay:"Lunas"});
  env.db.prepare("INSERT INTO access_roles(id,organization_id,name,built_in,payload_json,updated_at) VALUES('spv-payment','cuciin','Payment',0,?,1)").run(JSON.stringify({modules:["service"],functions:["service.payment"]}));
  env.db.exec("INSERT INTO staff(email,organization_id,name,role,approved,access_role_id,updated_at) VALUES('spv@cuciin.id','cuciin','SPV','Supervisor',1,'spv-payment',1)");
  policy(env,identities.spv,["service"],["service.payment"]);
  assert.equal((await send(env,wire("payment","pay-audit",{id:"pay-audit",notaId:p.id,branchId:"melati",amount:10000,method:"Tunai",atMs:2}),identities.spv)).code,403);
  assert.equal(rows(env,"SELECT * FROM payments").length,0);
});

test("P1 Supervisor cannot delete ledger payment",async()=>{
  const env=setup(); const p=await create(env,{...nota(),paid:10000,pay:"Lunas"});
  assert.equal((await send(env,wire("payment","pay-audit",{id:"pay-audit",notaId:p.id,branchId:"melati",amount:10000,method:"Tunai",atMs:2}),identities.owner)).accepted,true);
  env.db.prepare("INSERT INTO access_roles(id,organization_id,name,built_in,payload_json,updated_at) VALUES('spv-payment','cuciin','Payment',0,?,1)").run(JSON.stringify({modules:["service"],functions:["service.payment"]}));
  env.db.exec("INSERT INTO staff(email,organization_id,name,role,approved,access_role_id,updated_at) VALUES('spv@cuciin.id','cuciin','SPV','Supervisor',1,'spv-payment',1)");
  policy(env,identities.spv,["service"],["service.payment"]);
  assert.equal((await send(env,wire("payment","pay-audit",null,{branchId:"melati",operation:"delete"}),identities.spv)).code,403);
  assert.equal(rows(env,"SELECT * FROM payments").length,1);
  assert.equal(rows(env,"SELECT paid FROM orders")[0].paid,10000);
});

test("recorded ledger cannot be deleted by Owner or Kasir without refund",async()=>{
  const env=setup(); const p=await create(env,{...nota(),paid:10000,pay:"Lunas"});
  assert.equal((await send(env,wire("payment","pay-kept",{id:"pay-kept",notaId:p.id,branchId:"melati",amount:10000,method:"Tunai",atMs:2}),identities.owner)).accepted,true);
  for(const actor of [identities.kasir,identities.owner]) {
    const before=rows(env,"SELECT * FROM payments");
    assert.equal((await send(env,wire("payment","pay-kept",null,{branchId:"melati",operation:"delete"}),actor)).code,409);
    assert.deepEqual(rows(env,"SELECT * FROM payments"),before);
    assert.equal(rows(env,"SELECT paid FROM orders")[0].paid,10000);
  }
  assert.equal(rows(env,"SELECT * FROM sync_changes WHERE entity_type='payment' AND operation='delete'").length,0);
});

test("WhatsApp resend changes only waAt with send grant",async()=>{
  const env=setup(); const p=await create(env,{...nota(),waSent:true,waAt:"1 Okt 2026, 08.00"});
  policy(env,identities.kasir,["whatsapp"],["whatsapp.send"]);
  assert.equal((await send(env,wire("nota",p.id,{...p,waAt:"1 Okt 2026, 09.00"}))).accepted,true);
  assert.equal(rows(env,"SELECT wa_sent FROM orders")[0].wa_sent,1);
});

test("untrusted productKey on non-retail line is normalized and later status still passes",async()=>{
  const env=setup();
  const p=await create(env,{...nota(),lines:nota().lines.map(line=>({...line,productKey:"historical-product"}))});
  assert.equal(p.lines[0].productKey,"");
  policy(env,identities.kasir,["queue"],["queue.status"]);
  assert.equal((await send(env,wire("nota",p.id,{...p,laundry:"Progress"}))).accepted,true);
});

test("Android Kasir status-only nota needs no explicit intent",async()=>{
  const env=setup(); const p=await create(env); policy(env,identities.kasir,["queue"],["queue.status"]);
  assert.equal((await send(env,wire("nota",p.id,{...p,laundry:"Selesai",completedAt:"1 Okt 2026, 09.00"}))).accepted,true);
});

test("Android handover-only nota uses queue grant and preserves payment",async()=>{
  const env=setup(); const p=await create(env,{...nota(),paid:10000,pay:"Lunas",laundry:"Selesai",completedAt:"1 Okt 2026, 09.00"});
  policy(env,identities.kasir,["queue"],["queue.handover"]);
  const cmd=wire("nota",p.id,{...p,pickedUpAt:"1 Okt 2026, 10.00"});
  assert.equal((await send(env,cmd)).accepted,true);
  assert.equal((await send(env,cmd)).replayed,true);
  assert.equal(rows(env,"SELECT paid FROM orders")[0].paid,10000);
});

test("P1 Android payment-only nota and ledger replay without correction grant",async()=>{
  const env=setup(); const p=await create(env); policy(env,identities.kasir,["service"],["service.payment"]);
  const cmd=wire("nota",p.id,{...p,paid:10000,pay:"Lunas",payMethod:"Qris"});
  assert.equal((await send(env,cmd)).accepted,true);
  assert.equal((await send(env,cmd)).replayed,true);
  assert.equal(rows(env,"SELECT paid FROM orders")[0].paid,10000);
  assert.equal((await send(env,wire("payment","pay-audit",{id:"pay-audit",notaId:p.id,branchId:"melati",amount:10000,method:"Qris",atMs:2,at:"1 Okt 2026, 08.01",by:"Kasir Melati"}))).accepted,true);
  assert.equal(rows(env,"SELECT amount FROM payments")[0].amount,10000);
});

test("P1 operational status and WhatsApp changes remain narrow and replayable",async()=>{
  const env=setup(); let p=await create(env);
  policy(env,identities.kasir,["queue","whatsapp"],["queue.status","whatsapp.send"]);
  for(const delta of [{syncIntent:"status",laundry:"Selesai",completedAt:"1 Okt 2026, 09.00"},{waSent:true,waAt:"1 Okt 2026, 09.01"}]) {
    const cmd=wire("nota",p.id,{...p,...delta});
    assert.equal((await send(env,cmd)).accepted,true);
    assert.equal((await send(env,cmd)).replayed,true);
    p=JSON.parse(rows(env,"SELECT payload_json FROM orders")[0].payload_json);
  }
});

test("P1 status intent cannot change customer or payment",async()=>{
  const env=setup(); const p=await create(env); policy(env,identities.kasir,["queue"],["queue.status"]);
  assert.equal((await send(env,wire("nota",p.id,{...p,syncIntent:"status",laundry:"Selesai",customer:"Forged",paid:10000,pay:"Lunas"}))).accepted,false);
  assert.equal(rows(env,"SELECT customer_name,paid FROM orders")[0].customer_name,"Pelanggan");
  assert.equal(rows(env,"SELECT paid FROM orders")[0].paid,0);
});

test("P1 WhatsApp grant cannot create a new nota",async()=>{
  const env=setup(); await create(env); policy(env,identities.kasir,["whatsapp"],["whatsapp.send"]);
  assert.equal((await send(env,wire("nota","NEW-audit",{...nota(),id:"NEW-audit",waSent:true}))).code,403);
  assert.equal(rows(env,"SELECT id FROM orders").length,1);
});

test("P1 staff assignment limits grants without user policy",async()=>{
  const env=setup();
  assert.equal((await send(env,wire("accessRole","restricted",{id:"restricted",name:"Baca",modules:["customer"],functions:[]}),identities.owner)).accepted,true);
  assert.equal((await send(env,wire("staff",identities.kasir.email,{email:identities.kasir.email,name:"Kasir Melati",role:"Kasir",approved:true,branchIds:["melati"],accessRoleId:"restricted"}),identities.owner)).accepted,true);
  assert.equal((await send(env,wire("customer","c-1",{name:"Pelanggan"}))).code,403);
  assert.equal(rows(env,"SELECT * FROM customers").length,0);
});

test("P1 forged type cannot publish global nota journal",async()=>{
  const env=setup();
  const result=await send(env,wire("nota","forged",{id:"forged",name:"Forged",branchId:"kenanga"},{type:"customer.upsert",branchId:null}));
  assert.equal(result.code,422);
  assert.equal(rows(env,"SELECT * FROM customers").length,0);
  assert.equal(rows(env,"SELECT * FROM sync_changes").length,0);
  const pulled=await (await pullChanges(new Request("https://cuciin.example/v1/sync/changes"),env,identities.kasirLain)).json();
  assert.equal(pulled.changes.length,0);
});

test("P1 envelope operation must agree with explicit type",async()=>{
  const env=setup();
  for(const extra of [{operation:"delete",type:"customer.upsert"},{operation:"erase"},{entityType:"unknown",type:"customer.upsert"}]) {
    assert.equal((await send(env,wire("customer","forged",{name:"Forged"},extra))).code,422);
  }
  assert.equal(rows(env,"SELECT * FROM sync_changes").length,0);
});
