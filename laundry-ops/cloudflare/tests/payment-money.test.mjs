import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { pushCommands } from "../src/command-sync.ts";
import { fakeD1, seedBaseline, commandRequest, identities } from "./support/d1-harness.mjs";

const wire=JSON.parse(readFileSync(new URL("./fixtures/android-wire.json",import.meta.url),"utf8"));
const send=async(env,command)=>(await pushCommands(commandRequest([command]),env,identities.kasir)).json();
for(const quantities of [[1.0001],[1.0001,1.0001],[0.9999]]) test(`decimal money matches Android per-line truncation ${quantities}`,async()=>{
  const env=fakeD1();seedBaseline(env);
  try {
    env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',7000,1000,1)");
    const create=structuredClone(wire.create.commands[0]);
    const total=quantities.reduce((sum,qty)=>sum+Math.trunc(qty*7000),0);
    Object.assign(create.payload,{total,paid:total,pay:"Lunas"});
    create.payload.lines=quantities.map(qty=>({...create.payload.lines[0],qty,unitPrice:7000}));
    const result=(await send(env,create)).results[0];
    assert.equal(result.accepted,true,JSON.stringify(result));
    const saved=env.db.prepare("SELECT total,paid,payment_status,payload_json FROM orders").get();
    assert.equal(saved.total,total);
    assert.equal(saved.paid,total);
    assert.equal(JSON.parse(saved.payload_json).total,total);
    assert.equal(saved.payment_status,"Lunas");
  } finally {env.db.close();}
});

for(const [paid,pay] of [[0,"Lunas"],[10000,"Belum"]]) for(const direct of [false,true]) test(`inconsistent payment status rejected paid=${paid} pay=${pay} direct=${direct}`,async()=>{
  const env=fakeD1();seedBaseline(env);
  try {
    env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
    const create=structuredClone(wire.create.commands[0]);
    if(direct) {
      assert.equal((await send(env,create)).results[0].accepted,true);
      const result=(await send(env,{commandId:"invalid-status",type:"order.payment",entityId:create.entityId,branchId:"melati",payload:{paid,paymentStatus:pay,paymentMethod:"Tunai"}})).results[0];
      assert.equal(result.accepted,false,JSON.stringify(result));assert.equal(result.code,422);
      const saved=env.db.prepare("SELECT paid,payment_status FROM orders").get();assert.equal(saved.paid,0);assert.equal(saved.payment_status,"Belum");
    } else {
      Object.assign(create.payload,{paid,pay});
      const result=(await send(env,create)).results[0];
      assert.equal(result.accepted,false,JSON.stringify(result));assert.equal(result.code,422);
      assert.equal(env.db.prepare("SELECT count(*) n FROM orders").get().n,0);
    }
  } finally {env.db.close();}
});

test("unsafe grand total is rejected before writing order",async()=>{
  const env=fakeD1();seedBaseline(env);
  try {
    env.db.prepare("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',?,1000,1)").run(Number.MAX_SAFE_INTEGER);
    const create=structuredClone(wire.create.commands[0]);
    Object.assign(create.payload.lines[0],{qty:2,unitPrice:Number.MAX_SAFE_INTEGER});
    const result=(await send(env,create)).results[0];
    assert.equal(result.accepted,false,JSON.stringify(result));assert.equal(result.code,422);
    assert.equal(env.db.prepare("SELECT count(*) n FROM orders").get().n,0);
  } finally {env.db.close();}
});

async function setup() {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec("PRAGMA foreign_keys=ON; INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
  const create=structuredClone(wire.create.commands[0]);
  Object.assign(create.payload,{paid:10000,pay:"Lunas"});
  assert.equal((await send(env,create)).results[0].accepted,true);
  return env;
}

for(const concurrentAmount of [4000,10000]) test(`payment transaction rechecks concurrent ledger ${concurrentAmount}`,async()=>{
  const env=await setup();
  try {
    const payment=structuredClone(wire.payment.commands[1]);
    payment.payload.amount=concurrentAmount===4000?6000:10000;
    const originalBatch=env.batch.bind(env);
    env.batch=async statements=>{
      env.batch=originalBatch;
      env.db.prepare("INSERT INTO payments(id,organization_id,order_id,branch_id,amount,method,received_at,received_by,payload_json,updated_at) VALUES('concurrent','cuciin',?,'melati',?,'Tunai',1,'kasir@cuciin.id','{}',1)").run(payment.payload.notaId,concurrentAmount);
      return originalBatch(statements);
    };
    const journalBefore=env.db.prepare("SELECT count(*) n FROM sync_changes").get().n;
    const result=(await send(env,payment)).results[0];
    assert.equal(result.accepted,concurrentAmount===4000,JSON.stringify(result));
    const state=env.db.prepare("SELECT o.paid,sum(p.amount) ledger FROM orders o JOIN payments p ON p.order_id=o.id GROUP BY o.id").get();
    assert.equal(state.paid,10000);
    assert.equal(state.ledger,10000);
    if(concurrentAmount===10000) {
      assert.equal(result.code,409);
      assert.equal(env.db.prepare("SELECT count(*) n FROM processed_commands WHERE command_id=?").get(payment.commandId).n,0);
      assert.equal(env.db.prepare("SELECT count(*) n FROM sync_changes").get().n,journalBefore);
      assert.equal(env.db.prepare("SELECT count(*) n FROM sync_command_guards").get().n,0);
    } else {
      assert.equal((await send(env,payment)).results[0].replayed,true);
      assert.equal(env.db.prepare("SELECT sum(amount) paid FROM payments").get().paid,10000);
    }
  } finally {env.db.close();}
});
