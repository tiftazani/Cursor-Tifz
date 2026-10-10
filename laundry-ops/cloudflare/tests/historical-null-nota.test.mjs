import assert from "node:assert/strict";
import test from "node:test";
import { applyJournalToSnapshot, materializedSnapshot, visibleSnapshot } from "../src/index.ts";
import { pushCommands } from "../src/command-sync.ts";
import { commandRequest, fakeD1, identities, seedBaseline } from "./support/d1-harness.mjs";

function database(onRead) {
  const env=fakeD1();seedBaseline(env);
  env.db.exec("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,updated_at) VALUES('cuci','cuciin','Cuci','kg',10000,1000,1)");
  const prepare=env.prepare.bind(env);
  env.prepare=sql=>{
    let bound=[];
    const statement=prepare(sql),bind=statement.bind;
    statement.bind=(...values)=>{bound=values;return bind(...values);};
    statement.first=async()=>{const result=env.db.prepare(sql).get(...bound);onRead?.(sql,env);return result;};
    statement.all=async()=>{const results=env.db.prepare(sql).all(...bound);onRead?.(sql,env);return {results};};
    statement.run=async()=>{env.db.prepare(sql).run(...bound);return {success:true};};
    return statement;
  };
  return env;
}
function append(env,type="nota",payload=null,operation="upsert",updatedAt=Date.now()+1) {
  return Number(env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id) VALUES('cuciin',?,'historical-canceled',?,?,?,'melati')").run(type,operation,payload==null?null:JSON.stringify(payload),updatedAt).lastInsertRowid);
}
async function canceled(env) {
  const send=async command=>{
    const result=await (await pushCommands(commandRequest([command]),env,identities.owner)).json();
    assert.equal(result.results[0].accepted,true,JSON.stringify(result));
  };
  await send({commandId:"historical-create-0001",entityType:"nota",operation:"upsert",entityId:"historical-canceled",branchId:"melati",payload:{id:"historical-canceled",branchId:"melati",kasir:"Synthetic",customer:"Historical customer",createdAt:"30 Sep 2026",createdAtMs:1,total:20000,paid:20000,pay:"Lunas",payMethod:"Tunai",laundry:"Masuk",lines:[{serviceId:"cuci",name:"Cuci",qty:2,unit:"kg",unitPrice:10000}]}});
  await send({commandId:"historical-cancel-0001",type:"order.cancel",entityId:"historical-canceled",branchId:"melati",payload:{cancelReason:"Synthetic historical cancellation"}});
  const row=env.db.prepare("SELECT payload_json,updated_at FROM orders WHERE id='historical-canceled'").get();
  const payload=JSON.parse(row.payload_json);
  assert.ok(payload.canceledAtMs>0);
  return payload;
}
function poison(env,revision) {
  const changes=env.db.prepare("SELECT * FROM sync_changes ORDER BY sequence").all();
  const snapshot=applyJournalToSnapshot({},changes,revision);
  assert.deepEqual(snapshot.notas,[],"historical null upsert removes a still-persisted canceled order");
  env.db.prepare("INSERT INTO sync_snapshots VALUES('cuciin',?,?,?)").run(revision,JSON.stringify(snapshot),1);
}
function durable(env) {
  return JSON.stringify(["orders","order_lines","payments","expenses","sync_changes"].map(table=>env.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
}

test("poisoned cache recovers canceled authoritative nota without rewriting history or money",async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"nota",null,"upsert",payload.updatedAtMs+1);
  poison(env,revision);
  const before=durable(env);
  const result=await materializedSnapshot(env);
  assert.deepEqual(result.snapshot.notas,[payload]);
  assert.equal(result.revision,revision);
  assert.deepEqual(result.snapshot.deletedNotaIds,[]);
  assert.equal(durable(env),before);
  const cached=JSON.parse(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json);
  assert.deepEqual(cached.notas,[payload],"same-revision poisoned cache is repaired");
  assert.deepEqual((await materializedSnapshot(env)).snapshot,result.snapshot);
});

for(const alias of ["nota","order"]) test(`full replay recovers latest null ${alias} upsert and retains branch permissions`,async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,alias,null,"upsert",payload.updatedAtMs+1);
  const before=durable(env);
  const result=await materializedSnapshot(env,null);
  assert.deepEqual(result.snapshot.notas,[payload]);
  assert.equal(result.revision,revision);
  assert.deepEqual(visibleSnapshot(result.snapshot,identities.kasir).notas,[payload]);
  assert.deepEqual(visibleSnapshot(result.snapshot,identities.kasirLain).notas,[]);
  assert.deepEqual(visibleSnapshot(result.snapshot,{...identities.kasir,branchIds:[]}).notas,[]);
  assert.equal(durable(env),before);
});

for(const alias of ["nota","order"]) test(`later ${alias} delete beats historical null upsert even if order row remains`,async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  poison(env,append(env,alias==="nota"?"order":"nota",null,"upsert",payload.updatedAtMs+1));
  const revision=append(env,alias,null,"delete",payload.updatedAtMs+2);
  const before=durable(env);
  for(const base of [undefined,null]) {
    const result=await materializedSnapshot(env,base);
    assert.deepEqual(result.snapshot.notas,[]);
    assert.deepEqual(result.snapshot.deletedNotaIds,[payload.id]);
    assert.equal(result.revision,revision);
  }
  assert.equal(durable(env),before);
});

test("newer valid update wins over null upsert across aliases without a physical row",async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  poison(env,append(env,"order",null,"upsert",payload.updatedAtMs+1));
  const newer={...payload,customer:"Newer authoritative journal",updatedAtMs:payload.updatedAtMs+2};
  const revision=append(env,"nota",newer,"upsert",newer.updatedAtMs);
  env.db.exec("DELETE FROM orders WHERE id='historical-canceled'");
  for(const base of [undefined,null]) {
    const result=await materializedSnapshot(env,base);
    assert.deepEqual(result.snapshot.notas,[newer]);
    assert.equal(result.revision,revision);
  }
});

for(const [name,mutate] of [
  ["no physical persisted row",env=>env.db.exec("DELETE FROM orders WHERE id='historical-canceled'")],
  ["missing persisted payload",env=>env.db.exec("UPDATE orders SET payload_json=NULL")],
  ["invalid persisted JSON",env=>env.db.exec("UPDATE orders SET payload_json='{'")],
  ["physical row newer than frozen null upsert",env=>env.db.exec("UPDATE orders SET updated_at=updated_at+100")],
  ["payload version mismatches persisted row",env=>env.db.exec("UPDATE orders SET payload_json=json_set(payload_json,'$.updatedAtMs',1)")],
  ["incomplete persisted payload",env=>env.db.prepare("UPDATE orders SET payload_json=?").run(JSON.stringify({id:"historical-canceled",branchId:"melati"}))],
  ["foreign payload identity",env=>env.db.prepare("UPDATE orders SET payload_json=json_set(payload_json,'$.id','other')").run()],
  ["foreign payload branch",env=>env.db.prepare("UPDATE orders SET payload_json=json_set(payload_json,'$.branchId','kenanga')").run()],
]) test(`${name} fails explicit, does not fall back to earlier journal or cached nota`,async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"nota",null,"upsert",payload.updatedAtMs+1);
  poison(env,revision);mutate(env);
  const before=durable(env),cache=env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json;
  for(const base of [undefined,null]) await assert.rejects(materializedSnapshot(env,base),/snapshot_recovery_required/);
  assert.equal(durable(env),before);
  assert.equal(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json,cache);
});

for(const operation of ["upsert","delete"]) test(`concurrent ${operation} after frozen head cannot leak current persisted row into earlier recovery`,async t=>{
  let armed=false,appended=false,newer;
  const env=database(sql=>{
    if(!armed || appended || !sql.includes("MAX(sequence)")) return;
    appended=true;
    if(operation==="delete") env.db.exec("DELETE FROM orders WHERE id='historical-canceled'");
    else env.db.prepare("UPDATE orders SET payload_json=?,updated_at=? WHERE id='historical-canceled'").run(JSON.stringify(newer),newer.updatedAtMs);
    append(env,"order",operation==="delete"?null:newer,operation,newer.updatedAtMs);
  });t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"nota",null,"upsert",payload.updatedAtMs+1);
  poison(env,revision);
  newer={...payload,customer:"Concurrent newer",updatedAtMs:payload.updatedAtMs+2};armed=true;
  const cache=env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json;
  await assert.rejects(materializedSnapshot(env),/snapshot_recovery_required/);
  assert.equal(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json,cache);
  const result=await materializedSnapshot(env);
  assert.equal(result.revision,revision+1);
  assert.deepEqual(result.snapshot.notas,operation==="delete"?[]:[newer]);
  assert.deepEqual(result.snapshot.deletedNotaIds,operation==="delete"?[payload.id]:[]);
});

test("unrelated concurrent append stays beyond frozen recovery revision",async t=>{
  let armed=false,appended=false;
  const env=database(sql=>{
    if(armed && !appended && sql.includes("MAX(sequence)")) {
      appended=true;
      env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id) VALUES('cuciin','nota','unrelated','upsert',?,1,'kenanga')").run(JSON.stringify({id:"unrelated",branchId:"kenanga"}));
    }
  });t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"order",null,"upsert",payload.updatedAtMs+1);
  poison(env,revision);armed=true;
  const first=await materializedSnapshot(env);
  assert.equal(first.revision,revision);assert.deepEqual(first.snapshot.notas,[payload]);
  const second=await materializedSnapshot(env);
  assert.equal(second.revision,revision+1);
  assert.equal(second.snapshot.notas.length,2);
});

test("same-revision repair uses cache compare-and-swap and cannot overwrite a newer reader",async t=>{
  let armed=false,newerCache;
  const env=database(sql=>{
    if(armed && sql.includes("FROM sync_changes c LEFT JOIN orders")) {
      armed=false;
      env.db.prepare("UPDATE sync_snapshots SET payload_json=?").run(JSON.stringify(newerCache));
    }
  });t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"nota",null,"upsert",payload.updatedAtMs+1);
  poison(env,revision);
  newerCache={syncRevision:revision,notas:[{id:"newer-reader"}]};armed=true;
  const result=await materializedSnapshot(env);
  assert.equal(result.revision,revision);assert.deepEqual(result.snapshot.notas,[payload]);
  assert.deepEqual(JSON.parse(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json),newerCache);
});

test("cached complete nota cannot hide absent authoritative row for latest null upsert",async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"nota",null,"upsert",payload.updatedAtMs+1);
  env.db.prepare("INSERT INTO sync_snapshots VALUES('cuciin',?,?,1)").run(revision,JSON.stringify({syncRevision:revision,notas:[payload]}));
  env.db.exec("DELETE FROM orders WHERE id='historical-canceled'");
  await assert.rejects(materializedSnapshot(env),/snapshot_recovery_required/);
});

test("cache write failure does not prevent authoritative read-time recovery",async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  const revision=append(env,"nota",null,"upsert",payload.updatedAtMs+1);
  poison(env,revision);
  env.db.exec("CREATE TRIGGER deny_recovery_cache BEFORE UPDATE ON sync_snapshots BEGIN SELECT RAISE(FAIL,'synthetic cache denied'); END");
  const before=durable(env);
  const result=await materializedSnapshot(env);
  assert.deepEqual(result.snapshot.notas,[payload]);assert.equal(result.revision,revision);
  assert.equal(durable(env),before);
  assert.deepEqual(JSON.parse(env.db.prepare("SELECT payload_json FROM sync_snapshots").get().payload_json).notas,[]);
});

test("JSON null journal payload recovers a persisted legacy order canonically",async t=>{
  const env=database();t.after(()=>env.db.close());
  const payload=await canceled(env);
  const legacy={...payload,cashierName:payload.kasir,cashierEmail:payload.kasirEmail,customerName:payload.customer,paymentStatus:payload.pay,paymentMethod:payload.payMethod,workStatus:payload.laundry,createdAt:1,updatedAt:payload.updatedAtMs};
  for(const key of ["kasir","kasirEmail","customer","pay","payMethod","laundry","updatedAtMs"]) delete legacy[key];
  env.db.prepare("UPDATE orders SET payload_json=?").run(JSON.stringify(legacy));
  const revision=append(env,"order",null,"upsert",payload.updatedAtMs+1);
  env.db.prepare("UPDATE sync_changes SET payload_json='null' WHERE sequence=?").run(revision);
  const result=await materializedSnapshot(env,null);
  const nota=result.snapshot.notas[0];
  assert.equal(nota.kasir,payload.kasir);assert.equal(nota.customer,payload.customer);
  assert.equal(nota.createdAt,"1");assert.equal(nota.updatedAtMs,payload.updatedAtMs);
  assert.equal(nota.canceledAtMs,payload.canceledAtMs);assert.equal(result.revision,revision);
});
