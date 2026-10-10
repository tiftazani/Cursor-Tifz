import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { pushCommands } from "../src/command-sync.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

const wire=JSON.parse(readFileSync(new URL("./fixtures/android-wire.json",import.meta.url),"utf8"));
for(const action of ["payment","status","whatsapp","handover"]) {
  test(`payload Kotlin ${action} diterima dengan izin khususnya`,async()=>{
    const env=fakeD1(); seedBaseline(env);
    env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
    const send=async(batch)=>{
      let pending=batch.commands;const results=[];
      while(pending.length) {
        const response=await (await pushCommands(commandRequest(pending),env,identities.kasir)).json();
        const completed=response.results.filter(r=>r.status!=="retryable");assert.ok(completed.length);
        results.push(...completed);const done=new Set(completed.map(r=>r.commandId));pending=pending.filter(c=>!done.has(c.commandId));
      }
      return {results};
    };
    const initial=wire[action==="handover" ? "handoverBase" : "create"];
    assert.ok((await send(initial)).results.every(r=>r.accepted),"create Kotlin");
    const requirements={payment:["service","service.payment"],status:["queue","queue.status"],whatsapp:["whatsapp","whatsapp.send"],handover:["queue","queue.handover"]};
    const [module,fn]=requirements[action];
    env.db.prepare("INSERT INTO access_policies(email,organization_id,payload_json,updated_at) VALUES(?,'cuciin',?,1)").run(identities.kasir.email,JSON.stringify({modules:[module],functions:[fn]}));
    const result=await send(wire[action]);
    assert.ok(result.results.every(r=>r.accepted),JSON.stringify(result));
    const repeated=await send(wire[action]);
    assert.ok(repeated.results.every(r=>r.accepted && r.replayed),JSON.stringify(repeated));
    const order=rows(env,"SELECT * FROM orders")[0];
    if(action==="payment") { assert.equal(order.paid,10000); assert.equal(rows(env,"SELECT SUM(amount) AS amount FROM payments")[0].amount,10000); }
    if(action==="status") assert.equal(order.work_status,"Selesai");
    if(action==="whatsapp") assert.equal(order.wa_sent,1);
    if(action==="handover") assert.equal(order.picked_up_at,"1 Okt 2026, 10.00");
    env.db.close();
  });
}
