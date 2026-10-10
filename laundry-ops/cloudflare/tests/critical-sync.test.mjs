import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { pushCommands, pullChanges } from "../src/command-sync.ts";
import worker, { materializedSnapshot } from "../src/index.ts";
import { fakeD1, seedBaseline, commandRequest, identities } from "./support/d1-harness.mjs";

function setup() {
  const env=fakeD1(); seedBaseline(env); env.db.exec("PRAGMA foreign_keys=ON");
  env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('wash','cuciin','Wash','kg',10000,1000,1)");
  const prepare=env.prepare.bind(env), batch=env.batch.bind(env);
  env.calls=0; env.sql=0; env.limit=Infinity; env.budgetKind="calls";
  const hit=(n=1)=>{env.calls++;env.sql+=n;if(env[env.budgetKind]>env.limit) throw Error("SYNTHETIC_D1_QUERY_LIMIT");};
  env.prepare=sql=>{
    const statement=prepare(sql); let params=[];
    const bind=statement.bind, first=statement.first, all=statement.all;
    statement.bind=(...values)=>{params=values;return bind(...values);};
    statement.first=async()=>{hit();return first();};
    statement.all=async()=>{hit();return all();};
    statement.run=async()=>{hit();env.db.prepare(sql).run(...params);return {success:true};};
    return statement;
  };
  env.batch=async statements=>{hit(statements.length);if(env.beforeBatch){const hook=env.beforeBatch;env.beforeBatch=null;hook();}return batch(statements);};
  return env;
}
let serial=0;
const wire=(p,extra={})=>({commandId:`critical-sync-${++serial}`,entityType:"nota",entityId:p.id,branchId:p.branchId,operation:"upsert",payload:p,...extra});
const nota=(id="order-a")=>({id,branchId:"melati",kasir:identities.kasir.name,kasirEmail:identities.kasir.email,customer:"Synthetic",phone:"",items:"Wash",total:10000,paid:10000,pay:"Lunas",payMethod:"Tunai",laundry:"Masuk",createdAt:"1",createdAtMs:1,pickupAt:"",waSent:false,waAt:null,photos:[],dropOut:false,completedAt:null,pickedUpAt:null,updatedAtMs:0,canceledAtMs:0,canceledAt:"",canceledBy:"",cancelReason:"",lines:[{serviceId:"wash",name:"Wash",qty:1,unit:"kg",unitPrice:10000,handledByEmail:identities.kasir.email,handledByName:identities.kasir.name,commissionPerUnit:1000,productKey:""}]});
const send=async(env,commands,actor=identities.owner)=>(await pushCommands(commandRequest(commands),env,actor)).json();
const row=env=>env.db.prepare("SELECT * FROM orders WHERE id='order-a'").get();
async function create(env,p=nota()) {
  const result=await send(env,[wire(p)]); assert.equal(result.results[0].accepted,true,JSON.stringify(result));
  return JSON.parse(env.db.prepare("SELECT payload_json FROM orders WHERE id=?").get(p.id).payload_json);
}

test("a second cancellation keeps canonical nota and does not refund twice",async()=>{
  const env=setup();try {
    await create(env);
    const cancel=()=>wire({id:"order-a",branchId:"melati",syncIntent:"cancel",cancelReason:"Synthetic"});
    assert.equal((await send(env,[cancel()])).results[0].accepted,true);
    const before=await materializedSnapshot(env);
    assert.equal((await send(env,[cancel()])).results[0].accepted,true);
    const after=await materializedSnapshot(env);
    assert.deepEqual(after.snapshot.notas,before.snapshot.notas);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM expenses WHERE id='refund-order-a'").get().n,1);
    const pulled=await (await pullChanges(new Request(`https://synthetic.test/v1/sync/changes?after=${before.revision}`),env,identities.owner)).json();
    assert.ok(pulled.changes.every(c=>c.entityType!=="nota" || c.payload!==null));
  } finally {env.db.close();}
});

for(const type of ["order.status","order.payment","order.handover"]) test(`${type} OCC race cannot write payload or journal`,async()=>{
  const env=setup();try {
    await create(env);const previous=row(env), journalCount=env.db.prepare("SELECT COUNT(*) n FROM sync_changes").get().n;
    env.beforeBatch=()=>env.db.prepare("UPDATE orders SET work_status='Concurrent',updated_at=? WHERE id='order-a'").run(previous.updated_at+1000);
    const result=await send(env,[{commandId:`race-${type}`,type,entityId:"order-a",branchId:"melati",expectedUpdatedAt:previous.updated_at,payload:{workStatus:"Selesai",completedAt:"test",paid:10000,paymentStatus:"Lunas",paymentMethod:"Qris",pickedUpAt:"test",waAt:"test"}}]);
    assert.equal(result.results[0].accepted,false,JSON.stringify(result));assert.equal(result.results[0].code,409);
    assert.equal(row(env).payload_json,previous.payload_json);assert.equal(row(env).work_status,"Concurrent");
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM sync_changes").get().n,journalCount);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM processed_commands WHERE command_id=?").get(`race-${type}`).n,0);
  } finally {env.db.close();}
});

for(const kind of ["payment","status"]) test(`legacy null payload permits only canonical ${kind} intent`,async()=>{
  const env=setup();try {
    const legacy=nota();legacy.createdAt="1 Okt 2026, 08.00";
    const stored=await create(env,legacy); env.db.exec("UPDATE orders SET payload_json=NULL");
    env.db.prepare("INSERT INTO access_roles VALUES('role-kasir','cuciin','Payment only',1,?,1)").run(JSON.stringify({modules:["service"],functions:["service.payment"]}));
    const payload=kind==="payment" ? {...stored,payMethod:"Qris"} : {...stored,laundry:"Selesai",completedAt:"test",syncIntent:"status"};
    const actor=kind==="payment" ? identities.kasir : identities.spv;
    const result=await send(env,[wire(payload)],actor);
    assert.equal(result.results[0].accepted,true,JSON.stringify(result));
    const tampered=await send(env,[wire({...payload,customer:"Tampered"})],actor);
    assert.equal(tampered.results[0].accepted,false);assert.equal(tampered.results[0].code,403);
  } finally {env.db.close();}
});

test("snapshot cache ahead of journal fails without rewriting durable data",async()=>{
  const env=setup();try {
    await create(env);await materializedSnapshot(env);
    const cache=env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json;
    env.db.exec("DELETE FROM sync_changes");
    await assert.rejects(()=>materializedSnapshot(env),/recovery_required/);
    env.SYNC_SECRET="synthetic-fixture-only";
    const response=await worker.fetch(new Request("https://synthetic.test/v1/snapshot",{headers:{"x-cuciin-key":env.SYNC_SECRET}}),env);
    assert.equal(response.status,503);assert.equal((await response.json()).code,"snapshot_recovery_required");
    assert.equal(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json,cache);
    assert.ok(row(env));
  } finally {env.db.close();}
});

for(const budgetKind of ["calls","sql"]) test(`100 nota backlog returns ACK and finishes under 50 ${budgetKind}`,async()=>{
  const env=setup();try {
    env.db.prepare("INSERT INTO access_roles VALUES('role-kasir','cuciin','Kasir',1,?,1)").run(JSON.stringify({modules:["service"],functions:["service.create","service.correct","service.payment"]}));
    let pending=Array.from({length:100},(_,i)=>wire(nota(`backlog-${i}`)));
    let requests=0,maxCalls=0,maxSql=0;
    while(pending.length && requests<101) {
      env.calls=4;env.sql=4;env.limit=50;env.budgetKind=budgetKind;
      const response=await send(env,pending,identities.kasir);requests++;
      assert.equal(response.results.length,pending.length);
      assert.equal(response.results.filter(r=>r.status==="rejected").length,0);
      assert.ok(response.acknowledgedCommandIds.length>0,"each ACK advances backlog");
      maxCalls=Math.max(maxCalls,env.calls);maxSql=Math.max(maxSql,env.sql);
      assert.ok(env.calls<=50);assert.ok(env.sql<=50);
      // Lost ACK is safe: replay identical IDs before advancing the client queue.
      env.calls=4;env.sql=4;
      const replay=await send(env,pending,identities.kasir);
      assert.deepEqual(replay.acknowledgedCommandIds,response.acknowledgedCommandIds);
      assert.ok(replay.results.filter(r=>r.accepted).every(r=>r.status==="duplicate"));
      const ack=new Set(response.acknowledgedCommandIds);pending=pending.filter(c=>!ack.has(c.commandId));
    }
    assert.equal(pending.length,0);assert.equal(requests,100);
    console.log(JSON.stringify({backlog:100,budgetKind,requests,maxCalls,maxSql}));
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM orders").get().n,100);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM processed_commands").get().n,100);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM sync_changes WHERE entity_type='nota'").get().n,100);
  } finally {env.db.close();}
});

test("WhatsApp wire intent retains the OCC guard",async()=>{
  const env=setup();try {
    const stored=await create(env), previous=row(env);
    env.beforeBatch=()=>env.db.prepare("UPDATE orders SET updated_at=? WHERE id='order-a'").run(previous.updated_at+1000);
    const response=await send(env,[wire({...stored,waSent:true,waAt:"test"},{expectedUpdatedAt:previous.updated_at})]);
    assert.equal(response.results[0].code,409);assert.equal(row(env).payload_json,previous.payload_json);
  } finally {env.db.close();}
});

for(const retail of [false,true]) test(`80-line atomic order finishes under 50 SQL cap retail=${retail}`,async()=>{
  const env=setup();try {
    const p=nota();p.lines=Array.from({length:80},(_,i)=>({...p.lines[0],serviceId:retail?`retail-${i}`:"wash",unit:retail?"pcs":"kg",productKey:retail?`product-${i}`:""}));p.total=800000;p.paid=800000;
    if(retail) for(let i=0;i<80;i++) {
      env.db.prepare("INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) VALUES(?,'cuciin',?,0,1)").run(`product-${i}`,`Product ${i}`);
      env.db.prepare("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,product_id,updated_at) VALUES(?,'cuciin',?,'pcs',10000,1000,1,?,1)").run(`retail-${i}`,`Retail ${i}`,`product-${i}`);
      env.db.prepare("INSERT INTO branch_stocks VALUES('melati',?,10,1)").run(`product-${i}`);
    }
    env.calls=4;env.sql=4;env.limit=50;env.budgetKind="sql";
    const command=wire(p);
    const response=await send(env,[command],identities.kasir);
    assert.equal(response.results[0].accepted,true,JSON.stringify(response));
    console.log(JSON.stringify({largeOrder:true,retail,calls:env.calls,sql:env.sql}));
    assert.ok(env.sql<=50);assert.ok(env.calls<=50);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM order_lines").get().n,80);
    assert.equal(row(env).total,800000);
    if(retail) assert.ok(env.db.prepare("SELECT quantity FROM branch_stocks").all().every(r=>r.quantity===9));
    env.calls=4;env.sql=4;
    assert.equal((await send(env,[command],identities.kasir)).results[0].replayed,true);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM order_lines").get().n,80);
    if(retail) {
      const stored=JSON.parse(row(env).payload_json);
      const changed={...stored,total:1600000,pay:"Belum",lines:stored.lines.map(line=>({...line,qty:2}))};
      const correction=wire(changed,{expectedUpdatedAt:stored.updatedAtMs});
      env.db.exec("UPDATE branch_stocks SET quantity=0 WHERE product_id='product-79'");
      const before=env.db.prepare("SELECT * FROM branch_stocks ORDER BY product_id").all();
      const count=env.db.prepare("SELECT COUNT(*) n FROM sync_changes").get().n;
      env.calls=4;env.sql=4;
      const rejected=(await send(env,[correction])).results[0];
      assert.equal(rejected.accepted,false);assert.equal(rejected.code,409);
      assert.deepEqual(env.db.prepare("SELECT * FROM branch_stocks ORDER BY product_id").all(),before);
      assert.equal(row(env).payload_json,JSON.stringify(stored));
      assert.equal(env.db.prepare("SELECT COUNT(*) n FROM sync_changes").get().n,count);
      env.db.exec("UPDATE branch_stocks SET quantity=9 WHERE product_id='product-79'");
      env.calls=4;env.sql=4;
      assert.equal((await send(env,[correction])).results[0].accepted,true);
      assert.ok(env.sql<=50);
      assert.ok(env.db.prepare("SELECT quantity FROM branch_stocks").all().every(r=>r.quantity===8));
      env.calls=4;env.sql=4;
      const cancellation=wire({id:p.id,branchId:p.branchId,syncIntent:"cancel",cancelReason:"Synthetic"});
      assert.equal((await send(env,[cancellation])).results[0].accepted,true);
      assert.ok(env.sql<=50);
      assert.ok(env.db.prepare("SELECT quantity FROM branch_stocks").all().every(r=>r.quantity===10));
      assert.equal(env.db.prepare("SELECT SUM(amount) amount FROM expenses").get().amount,800000);
      assert.equal(env.db.prepare("SELECT count(*) n FROM sync_command_guards").get().n,0);
    }
    env.calls=4;env.sql=4;
    assert.equal((await send(env,[{commandId:"large-delete",type:"order.delete",entityId:p.id,branchId:p.branchId,payload:{}}])).results[0].accepted,false,"paid nota cannot delete");
  } finally {env.db.close();}
});

test("actual Kotlin offline payment batches finish with stable IDs and remapped ACK versions",async()=>{
  const env=setup();try {
    env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
    const batches=JSON.parse(readFileSync(new URL("./fixtures/offline-payment-wire.json",import.meta.url),"utf8"));
    const versions=new Map();let syntheticVersion=100, rejected=0;
    for(const batch of batches) {
      let pending=structuredClone(batch.commands).map(command=>{
        if(command.expectedUpdatedAt!=null) command.expectedUpdatedAt=versions.get(command.expectedUpdatedAt);
        if(command.entityType==="nota" && command.payload.updatedAtMs) command.payload.updatedAtMs=versions.get(command.payload.updatedAtMs);
        return command;
      });
      while(pending.length) {
        const result=await send(env,pending,identities.kasir);
        rejected+=result.results.filter(r=>r.status==="rejected").length;
        assert.ok(result.acknowledgedCommandIds.length>0,JSON.stringify(result));
        const replay=await send(env,pending,identities.kasir);
        assert.deepEqual(replay.acknowledgedCommandIds,result.acknowledgedCommandIds);
        for(const accepted of result.results.filter(r=>r.accepted)) {
          if(pending.find(c=>c.commandId===accepted.commandId).entityType==="nota") versions.set(syntheticVersion++,accepted.updatedAt);
        }
        const ack=new Set(result.acknowledgedCommandIds);pending=pending.filter(c=>!ack.has(c.commandId));
      }
    }
    assert.equal(rejected,0);
    assert.equal(env.db.prepare("SELECT paid FROM orders WHERE id='MLT-offline'").get().paid,10000);
    assert.equal(env.db.prepare("SELECT SUM(amount) amount FROM payments WHERE order_id='MLT-offline'").get().amount,10000);
    assert.deepEqual(env.db.prepare("SELECT command_id FROM processed_commands ORDER BY command_id").all().map(r=>r.command_id),["offline-command-0","offline-command-1","offline-command-2","offline-command-3","offline-command-4"]);
  } finally {env.db.close();}
});

test("explicit retail product link does not also change a same-name product",async()=>{
  const env=setup();try {
    env.db.exec("INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) VALUES('soap','cuciin','Soap',0,1),('legacy-wash','cuciin','Wash',0,1);UPDATE services SET retail=1,product_id='soap',unit='pcs' WHERE id='wash';INSERT INTO branch_stocks VALUES('melati','soap',10,1),('melati','legacy-wash',10,1)");
    const p=nota();p.lines[0]={...p.lines[0],unit:"pcs",productKey:"soap"};
    await create(env,p);
    assert.deepEqual(env.db.prepare("SELECT product_id,quantity FROM branch_stocks ORDER BY product_id").all().map(r=>({...r})),[{product_id:"legacy-wash",quantity:10},{product_id:"soap",quantity:9}]);
  } finally {env.db.close();}
});

test("stored retail productKey comes from server catalog, not the device",async()=>{
  const env=setup();try {
    env.db.exec("INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) VALUES('soap','cuciin','Soap',0,1),('detergent','cuciin','Detergent',0,1);UPDATE services SET retail=1,product_id='soap',unit='pcs' WHERE id='wash';INSERT INTO branch_stocks VALUES('melati','soap',10,1),('melati','detergent',10,1)");
    const p=nota();p.lines[0]={...p.lines[0],unit:"pcs",productKey:"detergent"};
    const stored=await create(env,p);
    assert.equal(stored.lines[0].productKey,"soap");
    assert.equal((await send(env,[wire({id:"order-a",branchId:"melati",syncIntent:"cancel",cancelReason:"Synthetic"})])).results[0].accepted,true);
    assert.deepEqual(env.db.prepare("SELECT product_id,quantity FROM branch_stocks ORDER BY product_id").all().map(r=>({...r})),[{product_id:"detergent",quantity:10},{product_id:"soap",quantity:10}]);
  } finally {env.db.close();}
});

test("relinked service correction keeps sold product and non-retail switch adds no phantom stock",async()=>{
  const env=setup();try {
    env.db.exec("INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) VALUES('soap','cuciin','Soap',0,1),('detergent','cuciin','Detergent',0,1);UPDATE services SET retail=1,product_id='soap',unit='pcs' WHERE id='wash';INSERT INTO branch_stocks VALUES('melati','soap',10,1),('melati','detergent',10,1)");
    const p=nota();p.lines[0]={...p.lines[0],unit:"pcs",productKey:"soap"};
    let stored=await create(env,p);
    env.db.exec("UPDATE services SET product_id='detergent' WHERE id='wash'");
    let result=await send(env,[wire({...stored,customer:"Synthetic edit"},{expectedUpdatedAt:stored.updatedAtMs})]);
    assert.equal(result.results[0].accepted,true,JSON.stringify(result));
    stored=JSON.parse(row(env).payload_json);assert.equal(stored.lines[0].productKey,"soap");
    env.db.exec("UPDATE services SET retail=0 WHERE id='wash'");
    result=await send(env,[wire({...stored,customer:"Synthetic edit 2"},{expectedUpdatedAt:stored.updatedAtMs})]);
    assert.equal(result.results[0].accepted,true,JSON.stringify(result));
    assert.deepEqual(env.db.prepare("SELECT product_id,quantity FROM branch_stocks ORDER BY product_id").all().map(r=>({...r})),[{product_id:"detergent",quantity:10},{product_id:"soap",quantity:9}]);
  } finally {env.db.close();}
});

test("cancel restores stock to the product sold even after service relink",async()=>{
  const env=setup();try {
    env.db.exec("INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) VALUES('soap','cuciin','Soap',0,1),('detergent','cuciin','Detergent',0,1);UPDATE services SET retail=1,product_id='soap',unit='pcs' WHERE id='wash';INSERT INTO branch_stocks VALUES('melati','soap',10,1),('melati','detergent',10,1)");
    const p=nota();p.lines[0]={...p.lines[0],unit:"pcs",productKey:"soap"};
    await create(env,p);
    env.db.exec("UPDATE services SET product_id='detergent' WHERE id='wash'");
    const result=await send(env,[wire({id:"order-a",branchId:"melati",syncIntent:"cancel",cancelReason:"Synthetic"})]);
    assert.equal(result.results[0].accepted,true,JSON.stringify(result));
    assert.deepEqual(env.db.prepare("SELECT product_id,quantity FROM branch_stocks ORDER BY product_id").all().map(r=>({...r})),[{product_id:"detergent",quantity:10},{product_id:"soap",quantity:10}]);
  } finally {env.db.close();}
});

test("existing retail nota cannot move branches or unbalance stock",async()=>{
  const env=setup();try {
    env.db.exec("INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) VALUES('soap','cuciin','Soap',0,1);UPDATE services SET retail=1,product_id='soap',unit='pcs' WHERE id='wash';INSERT INTO branch_stocks VALUES('melati','soap',10,1),('kenanga','soap',10,1)");
    const p=nota();p.lines[0].unit="pcs";p.lines[0].productKey="soap";const stored=await create(env,p);
    const count=env.db.prepare("SELECT COUNT(*) n FROM sync_changes").get().n;
    const result=await send(env,[wire({...stored,branchId:"kenanga"},{expectedUpdatedAt:stored.updatedAtMs})]);
    assert.equal(result.results[0].accepted,false,JSON.stringify(result));assert.equal(result.results[0].code,409);
    assert.equal(row(env).branch_id,"melati");assert.equal(row(env).payload_json,JSON.stringify(stored));
    assert.deepEqual(env.db.prepare("SELECT quantity FROM branch_stocks ORDER BY branch_id").all().map(r=>r.quantity),[10,9]);
    assert.equal(env.db.prepare("SELECT COUNT(*) n FROM sync_changes").get().n,count);
  } finally {env.db.close();}
});
