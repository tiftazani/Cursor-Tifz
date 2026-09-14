import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { canonicalHistoryPayload, commandFailureResult, commandPermission, nextEntityVersion, orderUpsertAllowed, parseCommand, pushCommands, stockMoveOrderReferenceAllowed, syncScopeKey } from "../src/command-sync.ts";
import { applyJournalToSnapshot, legacySnapshotWriteAllowed } from "../src/index.ts";

const migration = readFileSync(new URL("../migrations/0003_command_sync.sql", import.meta.url), "utf8");

test("migrasi menyediakan metadata idempotensi, journal cabang, dan penjaga stok", () => {
  for (const required of ["request_hash", "execution_token", "result_json", "branch_id", "command_id", "branch_stocks_nonnegative_update"]) {
    assert.match(migration, new RegExp(`\\b${required}\\b`));
  }
});

test("token eksekusi membuat replay command mengubah saldo tepat satu kali", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE processed_commands(command_id TEXT PRIMARY KEY,organization_id TEXT,execution_token TEXT,result_json TEXT);
    CREATE TABLE stock(product_id TEXT PRIMARY KEY,quantity INTEGER NOT NULL);
    INSERT INTO stock VALUES('detergen',10);
  `);
  const execute = (token) => {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT OR IGNORE INTO processed_commands VALUES(?,?,?,NULL)").run("cmd-device-0001","cuciin",token);
    db.prepare("UPDATE stock SET quantity=quantity-3 WHERE product_id='detergen' AND EXISTS(SELECT 1 FROM processed_commands WHERE command_id=? AND execution_token=? AND result_json IS NULL)").run("cmd-device-0001",token);
    db.prepare("UPDATE processed_commands SET result_json='{}' WHERE command_id=? AND execution_token=?").run("cmd-device-0001",token);
    db.exec("COMMIT");
  };
  execute("writer-a");
  execute("writer-b");
  assert.equal(db.prepare("SELECT quantity FROM stock").get().quantity,7);
});

test("stok negatif membatalkan seluruh transaksi", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE branch_stocks(product_id TEXT PRIMARY KEY,quantity INTEGER NOT NULL);
    CREATE TABLE journal(id TEXT PRIMARY KEY);
    CREATE TRIGGER nonnegative BEFORE UPDATE OF quantity ON branch_stocks WHEN NEW.quantity<0 BEGIN SELECT RAISE(ABORT,'stock_below_zero'); END;
    INSERT INTO branch_stocks VALUES('pewangi',2);
  `);
  assert.throws(() => {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE branch_stocks SET quantity=quantity-3 WHERE product_id='pewangi'").run();
      db.prepare("INSERT INTO journal VALUES('move-1')").run();
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }, /stock_below_zero/);
  assert.equal(db.prepare("SELECT quantity FROM branch_stocks").get().quantity,2);
  assert.equal(db.prepare("SELECT count(*) AS count FROM journal").get().count,0);
});

test("dua penjualan retail yang berebut stok satu hanya menyimpan satu order", () => {
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE orders(id TEXT PRIMARY KEY); CREATE TABLE stock(product_id TEXT PRIMARY KEY,quantity INTEGER NOT NULL);
    CREATE TRIGGER nonnegative BEFORE UPDATE OF quantity ON stock WHEN NEW.quantity<0 BEGIN SELECT RAISE(ABORT,'stock_below_zero'); END;
    INSERT INTO stock VALUES('sabun',1);`);
  const sell=(id)=>{ db.exec("BEGIN IMMEDIATE"); try { db.prepare("INSERT INTO orders VALUES(?)").run(id); db.prepare("UPDATE stock SET quantity=quantity-1 WHERE product_id='sabun'").run(); db.exec("COMMIT"); return true; } catch { db.exec("ROLLBACK"); return false; } };
  assert.equal(sell("nota-1"),true);
  assert.equal(sell("nota-2"),false);
  assert.equal(db.prepare("SELECT count(*) AS count FROM orders").get().count,1);
  assert.equal(db.prepare("SELECT quantity FROM stock").get().quantity,0);
});

test("otorisasi membatasi role, cabang, dan absensi orang lain", () => {
  const kasir={email:"kasir@cuciin.id",name:"Kasir",role:"Kasir",branchIds:["b1"],bootstrap:false};
  const spv={...kasir,email:"spv@cuciin.id",role:"Supervisor"};
  const owner={...kasir,role:"Owner",branchIds:[]};
  assert.equal(commandPermission(kasir,"order.create","b1").allowed,true);
  assert.equal(commandPermission(kasir,"order.create","b2").allowed,false);
  assert.equal(commandPermission(kasir,"service.upsert").allowed,false);
  assert.equal(commandPermission(spv,"order.payment","b1").allowed,false);
  assert.equal(commandPermission(spv,"order.status","b1").allowed,true);
  assert.equal(commandPermission(kasir,"attendance.upsert","b1","oranglain@cuciin.id").allowed,false);
  assert.equal(commandPermission(owner,"service.upsert").allowed,true);
});

test("envelope Android dipetakan tanpa mengganti nama entity Kotlin", () => {
  const nota=parseCommand({commandId:"device-command-001",entityType:"nota",entityId:"MLT-1",operation:"upsert",branchId:"melati",payload:{id:"MLT-1"}});
  assert.equal(nota.type,"order.put");
  assert.equal(nota.wireEntityType,"nota");
  const deletion=parseCommand({commandId:"device-command-002",entityType:"attendance",entityId:"abs-1",operation:"delete",branchId:"melati",payload:null});
  assert.equal(deletion.type,"attendance.delete");
  assert.deepEqual(deletion.payload,{});
});

test("kegagalan D1 sementara tidak ditandai sebagai penolakan permanen", () => {
  assert.deepEqual(commandFailureResult("device-command-003",new Error("D1 temporarily unavailable")),{
    commandId:"device-command-003",
    accepted:false,
    status:"retryable",
    code:503,
    error:"Command belum dapat diproses; perangkat akan mencoba lagi",
  });
  let invalid;
  try { parseCommand({commandId:"pendek",payload:{}}); } catch(error) { invalid=error; }
  const rejected=commandFailureResult("pendek",invalid);
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.code,422);
});

test("batch memberi status retryable saat eksekusi command mengalami gangguan D1", async () => {
  const env={DB:{prepare(sql) {
    if(sql.includes("SELECT request_hash,result_json FROM processed_commands")) {
      return {bind() { return {first() { throw new Error("D1 temporarily unavailable"); }}; }};
    }
    if(sql.includes("MAX(sequence)")) return {bind() { return {first:async()=>({revision:0})}; }};
    throw new Error(`SQL tidak diharapkan: ${sql}`);
  }}};
  const identity={email:"kasir@cuciin.id",name:"Kasir",role:"Kasir",branchIds:["melati"],bootstrap:false};
  const request=new Request("https://cuciin.example/v1/sync/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({commands:[{
    commandId:"device-command-004",entityType:"customer",entityId:"pelanggan-1",operation:"upsert",payload:{id:"pelanggan-1",name:"Pelanggan"},
  },{
    commandId:"device-command-005",entityType:"customer",entityId:"pelanggan-2",operation:"upsert",payload:{id:"pelanggan-2",name:"Pelanggan 2"},
  }]})});
  const originalError=console.error;
  console.error=()=>{};
  const result=await pushCommands(request,env,identity).finally(()=>{ console.error=originalError; });
  const body=await result.json();
  assert.equal(result.status,200);
  assert.deepEqual(body.acknowledgedCommandIds,[]);
  assert.equal(body.results[0].status,"retryable");
  assert.equal(body.results[0].code,503);
  assert.equal(body.results[1].status,"retryable");
  assert.match(body.results[1].error,/command sebelumnya/);
});

test("payload riwayat memperoleh syncId stabil dan actor terverifikasi", () => {
  const stockMove={at:"14 Sep 2026 10:15",atMs:1789355700000,product:"Detergen",kind:"Tambah",qty:2,by:"Kasir Melati",branchId:"melati",note:"Restok",balanceAfter:12};
  const audit={at:"14 Sep 2026 10:15",atMs:1789355700000,user:"Kasir Melati",branchId:"melati",action:"Stok Detergen ditambah"};
  assert.deepEqual(canonicalHistoryPayload(stockMove,"move-sync-001","melati","by","Kasir Terverifikasi"),{
    ...stockMove,syncId:"move-sync-001",by:"Kasir Terverifikasi",
  });
  assert.deepEqual(canonicalHistoryPayload(audit,"audit-sync-001","melati","user","Kasir Terverifikasi"),{
    ...audit,syncId:"audit-sync-001",user:"Kasir Terverifikasi",
  });
});

test("mutasi stok kompensasi tetap sah setelah Nota dihapus lebih dahulu", () => {
  assert.equal(stockMoveOrderReferenceAllowed(true,null,"melati"),true);
  assert.equal(stockMoveOrderReferenceAllowed(false,"melati","melati"),true);
  assert.equal(stockMoveOrderReferenceAllowed(false,"kenanga","melati"),false);
  assert.equal(stockMoveOrderReferenceAllowed(false,null,"melati"),false);
  assert.equal(stockMoveOrderReferenceAllowed(true,null,"melati",true),false);
  assert.equal(stockMoveOrderReferenceAllowed(false,"melati","melati",true),true);
});

test("versi OCC Service selalu naik walau jam berada pada milidetik sama", () => {
  assert.equal(nextEntityVersion(1000,1000),1001);
  assert.equal(nextEntityVersion(1002,1000),1002);
});

test("scope sinkronisasi stabil dan berubah saat akses cabang berubah", () => {
  assert.equal(syncScopeKey({email:"a",name:"A",role:"Kasir",branchIds:["b2","b1","b1"],bootstrap:false}),"kasir:b1,b2");
  assert.equal(syncScopeKey({email:"a",name:"A",role:"Kasir",branchIds:["b1"],bootstrap:false}),"kasir:b1");
  assert.equal(syncScopeKey({email:"o",name:"O",role:"Owner",branchIds:[],bootstrap:false}),"owner");
});

test("tombstone mencegah Nota lama hidup kembali", () => {
  assert.equal(orderUpsertAllowed(false,true),false);
  assert.equal(orderUpsertAllowed(false,false),true);
  assert.equal(orderUpsertAllowed(true,true),true);
});

test("bootstrap materialisasi journal dan membawa revision yang sudah tercakup", () => {
  const base={notas:[{id:"MLT-1",customer:"Lama"}],deletedNotaIds:[],updatedAt:10};
  const materialized=applyJournalToSnapshot(base,[
    {sequence:4,entity_type:"nota",entity_id:"MLT-1",operation:"upsert",payload_json:JSON.stringify({id:"MLT-1",customer:"Baru"}),updated_at:20},
    {sequence:5,entity_type:"nota",entity_id:"MLT-1",operation:"delete",payload_json:null,updated_at:21},
  ],5);
  assert.deepEqual(materialized.notas,[]);
  assert.deepEqual(materialized.deletedNotaIds,["MLT-1"]);
  assert.equal(materialized.syncRevision,5);
  assert.equal(materialized.updatedAt,21);
});

test("snapshot PUT lama hanya tersedia untuk bootstrap privat", () => {
  assert.equal(legacySnapshotWriteAllowed({bootstrap:true},0),true);
  assert.equal(legacySnapshotWriteAllowed({bootstrap:true},1),false);
  assert.equal(legacySnapshotWriteAllowed({bootstrap:false},0),false);
});
