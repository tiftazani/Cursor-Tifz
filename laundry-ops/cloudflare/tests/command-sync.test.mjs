import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { attendanceRecordOwnedBy, canonicalHistoryPayload, cashCloseCreateAllowed, commandFailureResult, commandPermission, nextEntityVersion, orderUpsertAllowed, parseCommand, pullChanges, pushCommands, staffJournalScopes, stockMoveOrderReferenceAllowed, syncScopeKey, trustedCommission } from "../src/command-sync.ts";
import { applyJournalToSnapshot, legacySnapshotWriteAllowed, visibleSnapshot } from "../src/index.ts";
import { commandRequest, fakeD1, identities, rows, seedBaseline } from "./support/d1-harness.mjs";

const migration = readFileSync(new URL("../migrations/0003_command_sync.sql", import.meta.url), "utf8");
const commandSyncSource = readFileSync(new URL("../src/command-sync.ts", import.meta.url), "utf8");

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
  assert.equal(commandPermission(kasir,"customer.delete").allowed,false);
  assert.equal(commandPermission(spv,"order.payment","b1").allowed,false);
  assert.equal(commandPermission(spv,"order.status","b1").allowed,true);
  assert.equal(commandPermission(spv,"customer.upsert").allowed,false);
  assert.equal(commandPermission(kasir,"attendance.upsert","b1","oranglain@cuciin.id").allowed,false);
  assert.equal(commandPermission(kasir,"attendance.upsert","b1","kasir@cuciin.id").allowed,true);
  assert.equal(attendanceRecordOwnedBy(kasir,"oranglain@cuciin.id"),false);
  assert.equal(attendanceRecordOwnedBy(kasir,"KASIR@CUCIIN.ID"),true);
  assert.equal(attendanceRecordOwnedBy(owner,"oranglain@cuciin.id"),true);
  assert.equal(commandPermission(owner,"service.upsert").allowed,true);
});

test("komisi transaksi selalu berasal dari katalog server", () => {
  const catalogue=new Map([["cuci-kering",2500]]);
  assert.equal(trustedCommission("cuci-kering",catalogue),2500);
  assert.equal(trustedCommission("layanan-lama",catalogue,new Map([["layanan-lama",1750]])),1750);
  assert.equal(trustedCommission("cuci-kering",catalogue,new Map([["cuci-kering",999999]])),2500);
  assert.throws(()=>trustedCommission("layanan-palsu",catalogue),/tidak tersedia/);
  assert.match(commandSyncSource,/FROM services WHERE organization_id=\? AND active=1 AND id IN/);
});

test("jurnal pembayaran bersifat append-only dan tidak boleh melebihi penerimaan Service", () => {
  assert.match(commandSyncSource,/INSERT INTO payments/);
  assert.match(commandSyncSource,/Pembayaran melebihi penerimaan Service/);
  assert.match(commandSyncSource,/Pembayaran tercatat tidak dapat dikurangi tanpa pengembalian dana/);
});

test("tutup kas bersifat append-only dan menolak ID yang sudah ada", () => {
  assert.equal(cashCloseCreateAllowed(null),true);
  assert.equal(cashCloseCreateAllowed("melati"),false);
});

test("delta staf dan cabang non-Owner dibatasi ke penugasan cabangnya", async () => {
  const statements=[];
  const env={DB:{prepare(sql) {
    statements.push(sql);
    return {bind() { return sql.includes("MAX(sequence)")
      ? {first:async()=>({revision:0})}
      : {all:async()=>({results:[]})}; }};
  }}};
  const identity={email:"kasir@cuciin.id",name:"Kasir",role:"Kasir",branchIds:["melati"],bootstrap:false};
  const result=await pullChanges(new Request("https://cuciin.example/v1/sync/changes?after=0"),env,identity);
  assert.equal(result.status,200);
  assert.match(statements[0],/entity_type NOT IN \('staff','branch','attendance'\)/);
  assert.match(statements[0],/json_extract\(payload_json,'\$\.staffEmail'\)/);
  assert.match(statements[0],/entity_type='branch' AND entity_id IN/);
});

test("pemindahan staf mengirim delete ke cabang lama dan upsert ke cabang baru", () => {
  assert.deepEqual(staffJournalScopes(["a","b"],["b","c"]),{deletes:["a"],upserts:["b","c"]});
  assert.deepEqual(staffJournalScopes(["a"],[]),{deletes:["a"],upserts:[null]});
});

test("snapshot absensi non-Owner hanya memuat catatan akun sendiri", () => {
  const snapshot={branches:[{id:"melati"}],staff:[],attendance:[
    {id:"own",branchId:"melati",staffEmail:"kasir@cuciin.id"},
    {id:"other",branchId:"melati",staffEmail:"rekan@cuciin.id"},
  ]};
  const identity={email:"kasir@cuciin.id",name:"Kasir",role:"Kasir",branchIds:["melati"],bootstrap:false};
  assert.deepEqual(visibleSnapshot(snapshot,identity).attendance.map(row=>row.id),["own"]);
});

test("envelope Android dipetakan tanpa mengganti nama entity Kotlin", () => {
  const nota=parseCommand({commandId:"device-command-001",entityType:"nota",entityId:"MLT-1",operation:"upsert",branchId:"melati",payload:{id:"MLT-1"}});
  assert.equal(nota.type,"order.put");
  assert.equal(nota.wireEntityType,"nota");
  const deletion=parseCommand({commandId:"device-command-002",entityType:"attendance",entityId:"abs-1",operation:"delete",branchId:"melati",payload:null});
  assert.equal(deletion.type,"attendance.delete");
  assert.deepEqual(deletion.payload,{});
});

test("setiap entityType yang dikirim Android punya alias command", () => {
  // Tanpa alias, command ditolak 422 dan perangkat mengulanginya tanpa henti.
  const cases={
    assetType:"assetType.upsert",
    accessRole:"accessRole.upsert",
    accessPolicy:"accessPolicy.upsert",
    inventory:"inventory.upsert",
    expense:"expense.upsert",
    payment:"payment.upsert",
    cashClose:"cashClose.upsert",
    stockMove:"stockMove.upsert",
    audit:"audit.upsert",
    branchStock:"branchStock.put",
    whatsappTemplate:"whatsappTemplate.upsert",
  };
  for (const [entityType, expected] of Object.entries(cases)) {
    const command=parseCommand({commandId:`device-command-${entityType}`,entityType,entityId:"x-1",operation:"upsert",branchId:"melati",payload:{id:"x-1"}});
    assert.equal(command.type,expected,`entityType ${entityType} harus dipetakan ke ${expected}`);
  }
  const removal=parseCommand({commandId:"device-command-remove",entityType:"assetType",entityId:"at-1",operation:"delete",branchId:"melati",payload:null});
  assert.equal(removal.type,"assetType.delete");
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
  assert.equal(syncScopeKey({email:"a",name:"A",role:"Kasir",branchIds:["b2","b1","b1"],bootstrap:false}),"kasir:a:b1,b2");
  assert.equal(syncScopeKey({email:"a",name:"A",role:"Kasir",branchIds:["b1"],bootstrap:false}),"kasir:a:b1");
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

test("migrasi nama Owner mengganti nama lewat jurnal, bukan hanya tabel", () => {
  const sql = readFileSync(new URL("../migrations/0008_owner_name_neutral.sql", import.meta.url), "utf8");
  // Nama netral harus diisi, dan perubahan wajib tercatat di jurnal supaya perangkat
  // yang sudah memegang snapshot ikut menerima nama baru.
  assert.match(sql, /UPDATE staff/);
  assert.match(sql, /INSERT OR IGNORE INTO sync_changes/);
  assert.match(sql, /'Cuciin'/);
  assert.match(sql, /owner-name-neutral-v1/);
  // Idempotensi: entri jurnal hanya ditulis bila command_id-nya belum ada.
  assert.match(sql, /NOT EXISTS/);
  // Jangan menyentuh alamat email: itu identitas akun Firebase.
  assert.match(sql, /tiftazani\.khara@gmail\.com/);
});

test("entri jurnal staff mengganti baris lama berdasarkan email", () => {
  const base={staff:[
    {name:"Tiftazani",email:"tiftazani.khara@gmail.com",role:"Owner"},
    {name:"Ustutifa",email:"us.archuleta1207@gmail.com",role:"Owner"},
  ],updatedAt:1};
  const materialized=applyJournalToSnapshot(base,[
    {sequence:1,entity_type:"staff",entity_id:"tiftazani.khara@gmail.com",operation:"upsert",
     payload_json:JSON.stringify({name:"Cuciin",email:"tiftazani.khara@gmail.com",role:"Owner"}),
     updated_at:2},
  ],1);
  assert.equal(materialized.staff.length,2,"baris lama harus diganti, bukan ditambah");
  const owner=materialized.staff.find(row=>row.email==="tiftazani.khara@gmail.com");
  assert.equal(owner.name,"Cuciin");
  // Owner kedua tidak boleh ikut berubah.
  const kedua=materialized.staff.find(row=>row.email==="us.archuleta1207@gmail.com");
  assert.equal(kedua.name,"Ustutifa");
});

test("entri jurnal bertipe order tetap masuk ke notas saat materialisasi", () => {
  const base={notas:[],deletedNotaIds:[],updatedAt:1};
  const materialized=applyJournalToSnapshot(base,[
    {sequence:1,entity_type:"order",entity_id:"MLT-9",operation:"upsert",payload_json:JSON.stringify({id:"MLT-9",customer:"Baru"}),updated_at:2},
  ],1);
  assert.deepEqual(materialized.notas.map(row=>row.id),["MLT-9"]);
  const removed=applyJournalToSnapshot(materialized,[
    {sequence:2,entity_type:"order",entity_id:"MLT-9",operation:"delete",payload_json:null,updated_at:3},
  ],2);
  assert.deepEqual(removed.notas,[]);
  assert.deepEqual(removed.deletedNotaIds,["MLT-9"]);
});

test("order.payment tidak menghapus rincian Nota pada payload tersimpan", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const created=await (await pushCommands(commandRequest([{
    commandId:"nota-create-0001",type:"order.create",entityId:"MLT-1",branchId:"melati",
    payload:{id:"MLT-1",branchId:"melati",customerName:"Pelanggan Uji",phone:"0812",total:20000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:2,unit:"kg",unitPrice:10000}]},
  }]),env,identities.kasir)).json();
  assert.equal(created.results[0].accepted,true);

  const paid=await (await pushCommands(commandRequest([{
    commandId:"nota-pay-0001",type:"order.payment",entityId:"MLT-1",branchId:"melati",
    payload:{paid:20000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.kasir)).json();
  assert.equal(paid.results[0].accepted,true);

  const stored=JSON.parse(rows(env,"SELECT payload_json FROM orders WHERE id='MLT-1'")[0].payload_json);
  assert.equal(stored.customer,"Pelanggan Uji","nama pelanggan tidak boleh hilang");
  assert.equal(stored.lines.length,1,"rincian layanan tidak boleh hilang");
  assert.equal(stored.paid,20000);
  assert.equal(stored.pay,"Lunas");

  const journal=rows(env,"SELECT entity_type,payload_json FROM sync_changes WHERE entity_type IN ('nota','order') ORDER BY sequence");
  assert.equal(journal.length,2);
  assert.equal(JSON.parse(journal[1].payload_json).customer,"Pelanggan Uji");
});

test("stock.batch menjurnal riwayat stok dan saldo sebagai entity yang dikenal perangkat", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at)
    VALUES('detergen','cuciin','Detergen',1,'BahanHabisPakai','pcs',1);`);
  const response=await pushCommands(commandRequest([{
    commandId:"stock-batch-0001",type:"stock.batch",entityId:"batch-1",branchId:"melati",
    payload:{branchId:"melati",items:[{productId:"detergen",productName:"Detergen",mode:"delta",quantity:5}]},
  }]),env,identities.kasir);
  const body=await response.json();
  assert.equal(body.results[0].accepted,true);
  assert.equal(rows(env,"SELECT quantity FROM branch_stocks WHERE branch_id='melati' AND product_id='detergen'")[0].quantity,5);
  const types=rows(env,"SELECT entity_type FROM sync_changes WHERE entity_type IN ('stockMove','branchStock','stock') ORDER BY entity_type").map(row=>row.entity_type);
  assert.deepEqual(types,["branchStock","stockMove"],"riwayat stok harus dijurnal dengan tipe yang dipahami materializer");
});

test("reproject memakai revisi jurnal terbaru supaya versi entity tidak mundur", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO sync_snapshots(organization_id,revision,payload_json,updated_at)
    VALUES('cuciin',999,json_object('branches',json_array(),'staff',json_array(),'syncRevision',999),1);`);
  env.db.exec(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at)
    VALUES('cuciin','nota','MLT-7','upsert',json_object('id','MLT-7','branchId','melati','customer','Uji','total',1000,'paid',0,'pay','Belum','laundry','Masuk','createdAtMs',1),1789567083606);`);
  const journal=env.db.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").get("cuciin");
  assert.equal(journal.revision,1,"jurnal punya revisi 1");
  const snapshotRevision=env.db.prepare("SELECT revision FROM sync_snapshots WHERE organization_id=?").get("cuciin").revision;
  assert.equal(snapshotRevision,999,"baris snapshot masih memakai revisi lama");
  const chosen=Math.max(snapshotRevision,1,journal.revision);
  assert.equal(chosen,999,"revisi yang dipakai tidak boleh lebih kecil dari revisi jurnal");
  assert.ok(chosen>=journal.revision,"versi entity tidak boleh mundur di bawah revisi jurnal");
});
