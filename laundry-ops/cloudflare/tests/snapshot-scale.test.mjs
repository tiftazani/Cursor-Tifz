import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { materializedSnapshot, applyJournalToSnapshot } from "../src/index.ts";
import { fakeD1, seedBaseline } from "./support/d1-harness.mjs";

function measuredD1(env,{denyCache=false,onRead}={}) {
  const calls=[];
  env.prepare=sql=>{
    let bound=[];
    const statement={bind(...values){bound=values;return statement;},
      async first(){calls.push(sql); const result=env.db.prepare(sql).get(...bound);onRead?.(sql,env);return result;},
      async all(){calls.push(sql); const results=env.db.prepare(sql).all(...bound);onRead?.(sql,env);return {results};},
      async run(){calls.push(sql);if(denyCache) throw Error("synthetic cache denied");env.db.prepare(sql).run(...bound);return {success:true};}};
    return statement;
  };
  return calls;
}
function change(entity_type,entity_id,payload,sequence,operation="upsert") {
  return {entity_type,entity_id,payload_json:payload?JSON.stringify(payload):null,sequence,operation,updated_at:sequence};
}

test("24050 journal rows without snapshot use bounded queries and cache replay",async()=>{
  const env=fakeD1();seedBaseline(env);
  const insert=env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at) VALUES('cuciin',?,?,?,?,?)");
  env.db.exec("BEGIN");
  for(let i=1;i<=24050;i++) {
    const order=i%2===0, id=order?`n-${i%1303}`:`a-${i%6000}`;
    const payload=order?{id,branchId:"melati",kasir:"Synthetic",customer:"Synthetic",items:"Cuci",total:i,paid:0,pay:"Belum",laundry:"Masuk",createdAt:"Synthetic",pickupAt:"",waSent:false,lines:[]}:{syncId:id,branchId:"melati",action:"Synthetic",note:"x".repeat(930)};
    insert.run(order?"nota":"audit",id,"upsert",JSON.stringify(payload),i);
  }
  env.db.exec("COMMIT");
  const calls=measuredD1(env); const start=performance.now(); const cpu=process.cpuUsage();
  const {snapshot,revision}=await materializedSnapshot(env);
  const usage=process.cpuUsage(cpu);
  console.log(JSON.stringify({rows:24050,orders:snapshot.notas.length,payloadBytes:Buffer.byteLength(JSON.stringify(snapshot)),queries:calls.length,wallMs:performance.now()-start,cpuMs:(usage.user+usage.system)/1000}));
  assert.equal(revision,24050);assert.equal(snapshot.notas.length,1303);
  assert.ok(calls.length<=16,`query budget: ${calls.length}, expected <=16`);
  assert.equal(env.db.prepare("SELECT count(*) AS n FROM sync_snapshots").get().n,1,"cache created without base");
  calls.length=0;
  assert.deepEqual((await materializedSnapshot(env)).snapshot,snapshot);
  assert.ok(calls.length<=3,`cached read queries ${calls.length}`);
  env.db.close();
});

test("cache denied must not fail GET; local credential never escapes journal replay",async()=>{
  const env=fakeD1();seedBaseline(env);
  env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at) VALUES('cuciin','staff','synthetic@example.test','upsert',?,1)").run(JSON.stringify({email:"synthetic@example.test",passwordHash:"synthetic-nonsecret"}));
  env.db.prepare("INSERT INTO sync_snapshots VALUES('cuciin',0,'{\"syncRevision\":0,\"staff\":[{\"email\":\"old@example.test\",\"passwordHash\":\"synthetic\"}]}',0)").run();
  measuredD1(env,{denyCache:true});
  const {snapshot}=await materializedSnapshot(env);
  assert.ok(snapshot.staff.every(person=>!("passwordHash" in person)));env.db.close();
});

test("concurrent append waits for next read; slower cache cannot replace newer base",async()=>{
  const env=fakeD1();seedBaseline(env);
  const append=env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at) VALUES('cuciin','nota',?,'upsert',?,?)");
  append.run("first",JSON.stringify({id:"first"}),1);
  let appended=false;
  measuredD1(env,{onRead(sql){if(sql.includes("MAX(sequence)")&&!appended){appended=true;append.run("second",JSON.stringify({id:"second"}),2);}}});
  const first=await materializedSnapshot(env);
  assert.equal(first.revision,1);assert.deepEqual(first.snapshot.notas,[{id:"first"}]);
  const second=await materializedSnapshot(env);
  assert.equal(second.revision,2);assert.deepEqual(second.snapshot.notas,[{id:"first"},{id:"second"}]);
  // Simulate another reader finishing after our boundary read but before our cache write.
  measuredD1(env,{onRead(sql){if(sql.includes("sequence<=?")) env.db.prepare("UPDATE sync_snapshots SET payload_json=? WHERE organization_id='cuciin'").run(JSON.stringify({syncRevision:99,notas:[{id:"newer"}]}));}});
  await materializedSnapshot(env,{payload_json:JSON.stringify({syncRevision:0})});
  assert.equal(JSON.parse(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json).syncRevision,99);
  env.db.close();
});

test("attendance ID reuse cannot leave a stale natural-key index",()=>{
  const a={id:"a",staffEmail:"synthetic@example.test",workDate:"2026-10-10",branchId:"melati",checkInAtMs:1};
  const b={...a,workDate:"2026-10-11"};
  const result=applyJournalToSnapshot({attendance:[a]},[change("attendance","a",b,1),change("attendance","new-a",{...a,id:"new-a"},2)],2);
  assert.equal(result.attendance.length,2);
  assert.deepEqual(result.attendance.map(row=>row.workDate).sort(),["2026-10-10","2026-10-11"]);
});

test("attendance merge aliases, note, delete and nota tombstones survive projection",()=>{
  const old={id:"random",staffEmail:"Synthetic@example.test",workDate:"2026-10-10",branchId:"melati",checkInAtMs:10,checkInAt:"in",checkOutAtMs:20,checkOutAt:"out",note:"kept"};
  const changes=[change("attendance","deterministic",{...old,id:"deterministic",checkInAtMs:30,checkOutAtMs:null,checkOutAt:null,note:""},1),change("nota","removed",null,2,"delete"),change("nota","restored",{id:"restored"},3),change("attendance","deterministic",null,4,"delete")];
  const result=applyJournalToSnapshot({attendance:[old],notas:[{id:"removed"}],deletedNotaIds:["restored"]},changes.slice(0,3),3);
  assert.equal(result.attendance.length,1);assert.equal(result.attendance[0].checkInAtMs,10);assert.equal(result.attendance[0].checkOutAtMs,20);assert.equal(result.attendance[0].note,"kept");
  assert.deepEqual(result.deletedNotaIds,["removed"]);assert.deepEqual(result.notas,[{id:"restored"}]);
  assert.deepEqual(applyJournalToSnapshot(result,changes.slice(3),4).attendance,[]);
});
