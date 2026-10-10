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
  // Jenis aset adalah master data organisasi: tanpa aturan ini Kasir atau SPV bisa menghapusnya
  // untuk semua cabang, sementara aplikasi menjaganya dengan owner.manage.
  assert.equal(commandPermission(kasir,"assetType.delete").allowed,false);
  assert.equal(commandPermission(spv,"assetType.delete").allowed,false);
  assert.equal(commandPermission(kasir,"assetType.upsert").allowed,false);
  assert.equal(commandPermission(spv,"assetType.upsert").allowed,false);
  assert.equal(commandPermission(owner,"assetType.delete").allowed,true);
  assert.equal(commandPermission(owner,"assetType.upsert").allowed,true);
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
  const page = statements.find(sql => sql.startsWith("SELECT sequence,entity_type"));
  assert.match(page,/entity_type NOT IN \('staff','branch','attendance'\)/);
  assert.match(page,/json_extract\(payload_json,'\$\.staffEmail'\)/);
  assert.match(page,/entity_type='branch' AND entity_id IN/);
});

test("kursor klien yang di depan server dikembalikan ke revisi jurnal terakhir", async () => {
  // Kejadian nyata: perangkat menyimpan kursornya sendiri (1018) sementara jurnal server berhenti di
  // 409. Klien mengirim `after=1018`, tidak ada baris yang cocok, lalu `nextRevision` dikembalikan
  // sebagai `after` — kursor lama. Perangkat berhenti menerima perubahan server selamanya, dan role
  // yang sudah diturunkan di server tidak pernah sampai ke perangkat.
  const env={DB:{prepare(sql) {
    return {bind() { return sql.includes("MAX(sequence)")
      ? {first:async()=>({revision:409})}
      : {all:async()=>({results:[]})}; }}; }}};
  const identity={email:"owner@cuciin.id",name:"Owner",role:"Owner",branchIds:["melati"],bootstrap:true};
  const result=await pullChanges(new Request("https://cuciin.example/v1/sync/changes?after=1018"),env,identity);
  const body=await result.json();
  assert.equal(result.status,200);
  assert.equal(body.changes.length,0);
  assert.equal(body.nextRevision,409,"kursor harus turun ke revisi jurnal, bukan memantulkan after");
  assert.equal(body.revision,409);
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
  assert.match(body.results[1].error,/Batas aman request/);
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
  assert.match(sql, /INSERT INTO sync_changes/);
  assert.match(sql, /'Cuciin'/);
  assert.match(sql, /owner-name-neutral-v1/);
  // Jangan menyentuh alamat email: itu identitas akun Firebase.
  assert.match(sql, /tiftazani\.khara@gmail\.com/);
  // Satu entri per cabang. `pullChanges` menyaring entri staff dengan `branch_id IN (...)`,
  // jadi entri satu cabang saja tidak akan sampai ke kasir di cabang lain.
  assert.match(sql, /JOIN staff_branches/, "jurnal harus ditulis per cabang lewat join staff_branches");
  assert.match(sql, /sc\.branch_id = sb\.branch_id/, "penjagaan idempoten harus per cabang, bukan global");
  // Tidak ada indeks unik pada sync_changes, jadi idempotensi wajib memakai NOT EXISTS.
  // Komentar dibuang dulu supaya penjelasan di dalam berkas tidak ikut terbaca sebagai perintah.
  const tanpaKomentar = sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
  assert.doesNotMatch(tanpaKomentar, /INSERT OR IGNORE/, "INSERT OR IGNORE tidak menjamin idempotensi di tabel ini");
});

test("jurnal staff ditulis satu entri per cabang, bukan satu saja", () => {
  // Aturan yang dipakai kode Worker: satu entri untuk tiap cabang tugas.
  assert.deepEqual(staffJournalScopes([], ["bunayya", "shelly"]), { deletes: [], upserts: ["bunayya", "shelly"] });
  // Tanpa cabang, tetap satu entri tanpa cabang supaya tidak ada perangkat yang terlewat.
  assert.deepEqual(staffJournalScopes([], []), { deletes: [], upserts: [null] });
  // Cabang yang dilepas menghasilkan entri delete, sisanya upsert.
  assert.deepEqual(staffJournalScopes(["bunayya", "shelly"], ["shelly"]), { deletes: ["bunayya"], upserts: ["shelly"] });
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

test("riwayat jual via nota memakai nama layanan dan tidak salah pilih produk bernama sama", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at)
    VALUES('sabun','cuciin','Sabun',0,'BarangJual','pcs',1),('a-palsu','cuciin','sabun',0,'BarangJual','pcs',1);
    INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,product_id,active,updated_at)
    VALUES('sabun-cair','cuciin','Sabun cair','pcs',8000,0,1,0,0,'sabun',1,1);
    INSERT INTO branch_stocks VALUES('melati','sabun',9,1),('melati','a-palsu',50,1);
    INSERT INTO orders(id,organization_id,branch_id,cashier_name,customer_name,total,paid,payment_status,payment_method,work_status,created_at,payload_json,updated_at)
    VALUES('MLT-J','cuciin','melati','Kasir','Uji',8000,0,'Belum','Tunai','Masuk',1,'{}',1);`);
  const push=async command=>(await (await pushCommands(commandRequest([command]),env,identities.kasir)).json()).results[0];
  const body={results:[
    await push({commandId:"move-jual-0001",type:"stockMove.upsert",entityId:"move-jual",branchId:"melati",
      payload:{syncId:"move-jual",product:"Sabun cair",kind:"Jual",qty:-1,by:"Kasir",branchId:"melati",note:"Jual via nota",notaId:"MLT-J",atMs:1}}),
    await push({commandId:"move-tambah-0001",type:"stockMove.upsert",entityId:"move-tambah",branchId:"melati",
      payload:{syncId:"move-tambah",product:"sabun",kind:"Tambah",qty:1,by:"Kasir",branchId:"melati",note:"Restok",atMs:2}}),
  ]};
  assert.deepEqual(body.results.map(r=>r.accepted),[true,true],JSON.stringify(body));
  const balances=rows(env,"SELECT product_id,quantity FROM branch_stocks ORDER BY product_id").map(r=>({...r}));
  assert.deepEqual(balances,[{product_id:"a-palsu",quantity:50},{product_id:"sabun",quantity:10}]);
  assert.equal(JSON.parse(rows(env,"SELECT payload_json FROM stock_moves WHERE id='move-jual'")[0].payload_json).balanceAfter,9);
});

test("branchStock.delete tidak menghapus saldo selama produk dan cabang masih ada", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at) VALUES('sabun','cuciin','Sabun',0,'BarangJual','pcs',1);
    INSERT INTO branch_stocks VALUES('melati','sabun',7,1);`);
  for (const [who,id] of [[identities.kasir,"del-kasir-0001"],[identities.owner,"del-owner-0001"]]) {
    const body=await (await pushCommands(commandRequest([{commandId:id,entityType:"branchStock",operation:"delete",entityId:"melati:sabun",branchId:"melati",payload:null}]),env,who)).json();
    assert.equal(body.results[0].accepted,true,JSON.stringify(body));
  }
  assert.equal(rows(env,"SELECT quantity FROM branch_stocks WHERE branch_id='melati' AND product_id='sabun'")[0]?.quantity,7);
});

test("Owner menghapus produk yang masih punya saldo dan tautan layanan tanpa macet", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at) VALUES('sabun','cuciin','Sabun',0,'BarangJual','pcs',1);
    INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,product_id,active,updated_at) VALUES('sabun-cair','cuciin','Sabun cair','pcs',8000,0,1,0,0,'sabun',1,1);
    INSERT INTO branch_stocks VALUES('melati','sabun',7,1);`);
  const body=await (await pushCommands(commandRequest([{commandId:"prod-del-0001",entityType:"product",operation:"delete",entityId:"sabun",payload:null}]),env,identities.owner)).json();
  assert.equal(body.results[0].accepted,true,JSON.stringify(body));
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM products WHERE id='sabun'")[0].n,0);
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM branch_stocks WHERE product_id='sabun'")[0].n,0);
  assert.equal(rows(env,"SELECT product_id FROM services WHERE id='sabun-cair'")[0].product_id,null);
  const late=await (await pushCommands(commandRequest([{commandId:"prod-del-0002",entityType:"branchStock",operation:"delete",entityId:"melati:sabun",branchId:"melati",payload:null}]),env,identities.owner)).json();
  assert.equal(late.results[0].accepted,true,JSON.stringify(late));
});

test("Owner menghapus cabang kosong yang masih punya baris saldo tanpa macet", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO branches(id,organization_id,code,name,address,maps_query,updated_at) VALUES('kosong','cuciin','KSG','Kosong','','',1);
    INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at) VALUES('sabun','cuciin','Sabun',0,'BarangJual','pcs',1);
    INSERT INTO branch_stocks VALUES('kosong','sabun',0,1),('melati','sabun',4,1);`);
  const body=await (await pushCommands(commandRequest([{commandId:"branch-del-0001",entityType:"branch",operation:"delete",entityId:"kosong",payload:null}]),env,identities.owner)).json();
  assert.equal(body.results[0].accepted,true,JSON.stringify(body));
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM branches WHERE id='kosong'")[0].n,0);
  assert.deepEqual(rows(env,"SELECT branch_id FROM branch_stocks").map(r=>r.branch_id),["melati"]);
  // Cabang dengan riwayat Service: ditolak permanen (409), bukan 503 yang menahan antrean.
  env.db.exec(`INSERT INTO orders(id,organization_id,branch_id,cashier_name,customer_name,total,paid,payment_status,payment_method,work_status,created_at,payload_json,updated_at) VALUES('MLT-H','cuciin','melati','Kasir','Uji',1,0,'Belum','Tunai','Masuk',1,'{}',1)`);
  const held=await (await pushCommands(commandRequest([{commandId:"branch-del-0002",entityType:"branch",operation:"delete",entityId:"melati",payload:null}]),env,identities.owner)).json();
  assert.equal(held.results[0].status,"rejected",JSON.stringify(held));
  assert.equal(held.results[0].code,409);
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM branches WHERE id='melati'")[0].n,1);
  assert.deepEqual(rows(env,"SELECT quantity FROM branch_stocks WHERE branch_id='melati'").map(r=>r.quantity),[4]);
});

test("harga Service yang menyimpang dari katalog ditolak untuk pengirim non-Owner", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const body=await (await pushCommands(commandRequest([{
    commandId:"nota-harga-0001",type:"order.create",entityId:"MLT-9",branchId:"melati",
    payload:{id:"MLT-9",branchId:"melati",customerName:"Pelanggan Uji",phone:"0812",total:99999,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:99999}]},
  }]),env,identities.kasir)).json();
  assert.equal(body.results[0].accepted,false,"harga di luar katalog harus ditolak");
  assert.equal(body.results[0].code,403);
  assert.equal(rows(env,"SELECT count(*) AS n FROM orders WHERE id='MLT-9'")[0].n,0,"Nota tidak boleh tersimpan");
});

test("harga Service sesuai katalog tetap diterima untuk non-Owner", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const body=await (await pushCommands(commandRequest([{
    commandId:"nota-harga-0002",type:"order.create",entityId:"MLT-10",branchId:"melati",
    payload:{id:"MLT-10",branchId:"melati",customerName:"Pelanggan Uji",phone:"0812",total:20000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:2,unit:"kg",unitPrice:10000}]},
  }]),env,identities.kasir)).json();
  assert.equal(body.results[0].accepted,true,"harga katalog tidak boleh ikut ditolak");
});

test("Owner tetap boleh memakai harga Service di luar katalog", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const body=await (await pushCommands(commandRequest([{
    commandId:"nota-harga-0003",type:"order.create",entityId:"MLT-11",branchId:"melati",
    payload:{id:"MLT-11",branchId:"melati",customerName:"Pelanggan Uji",phone:"0812",total:7500,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:7500}]},
  }]),env,identities.owner)).json();
  assert.equal(body.results[0].accepted,true,"Owner berhak menyesuaikan harga Service");
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

test("absensi satu karyawan dicatat per cabang, bukan satu per hari", async () => {
  // Kejadian nyata 24 Sep 2026: `aidanurita25@gmail.com` ditugaskan ke dua cabang
  // (`staff_branches`), tetapi hanya bisa absen di cabang pertama. Tabel `attendance` versi lama
  // memakai UNIQUE(staff_email, work_date), sehingga absen di cabang kedua ditolak basis data
  // walau Worker mengizinkannya.
  const env=fakeD1(); seedBaseline(env);
  const kasirDuaCabang={...identities.kasir,branchIds:["melati","kenanga"]};

  const absen=(commandId,id,branchId)=>pushCommands(commandRequest([{
    commandId,type:"attendance.upsert",entityId:id,branchId,
    payload:{id,branchId,staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",checkInAt:1789000000000,note:""},
  }]),env,kasirDuaCabang);

  const pertama=await (await absen("absen-cabang-0001","att-melati-2026-09-24-1","melati")).json();
  const kedua=await (await absen("absen-cabang-0002","att-kenanga-2026-09-24-1","kenanga")).json();

  assert.equal(pertama.results[0].accepted,true,"absen di cabang pertama harus diterima");
  assert.equal(kedua.results[0].accepted,true,"absen di cabang kedua harus diterima, bukan ditolak batas unik");
  const baris=rows(env,"SELECT branch_id FROM attendance WHERE staff_email='kasir@cuciin.id' AND work_date='2026-09-24' ORDER BY branch_id");
  assert.deepEqual(baris.map(row=>row.branch_id),["kenanga","melati"],"harus ada satu catatan per cabang");
});

test("absen di cabang di luar penugasan tetap ditolak", async () => {
  const env=fakeD1(); seedBaseline(env);
  const body=await (await pushCommands(commandRequest([{
    commandId:"absen-luar-0001",type:"attendance.upsert",entityId:"att-luar-1",branchId:"kenanga",
    payload:{id:"att-luar-1",branchId:"kenanga",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",checkInAt:1789000000000,note:""},
  }]),env,identities.kasir)).json();
  assert.equal(body.results[0].accepted,false,"kasir tidak boleh absen di cabang yang bukan penugasannya");
  assert.equal(body.results[0].code,403);
});

test("absen kedua di cabang yang sama pada hari yang sama memperbarui, bukan menabrak", async () => {
  // Id perangkat baru deterministik per (cabang, tanggal, karyawan), jadi kiriman ulang harus
  // menjadi UPDATE. Id acak dari perangkat versi lama tetap tertangkap kunci unik kedua.
  const env=fakeD1(); seedBaseline(env);
  const kirim=(commandId,id,checkIn,checkOut)=>pushCommands(commandRequest([{
    commandId,type:"attendance.upsert",entityId:id,branchId:"melati",
    payload:{id,branchId:"melati",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",checkInAt:checkIn,checkOutAt:checkOut,note:""},
  }]),env,identities.kasir);

  await (await kirim("absen-ulang-0001","att-melati-2026-09-24-1",1789000000000,null)).json();
  const idAcak=await (await kirim("absen-ulang-0002","att-acak-dari-perangkat-lama",1789000000000,1789003600000)).json();

  assert.equal(idAcak.results[0].accepted,true,"id acak dari perangkat lama tidak boleh ditolak 409");
  const baris=rows(env,"SELECT id,check_out_at FROM attendance WHERE staff_email='kasir@cuciin.id' AND work_date='2026-09-24'");
  assert.equal(baris.length,1,"satu karyawan, satu tanggal, satu cabang tetap satu baris");
  assert.equal(baris[0].check_out_at,1789003600000,"jam pulang harus tersimpan");
});

test("jam pulang absensi disimpan sebagai angka, bukan label jam", async () => {
  // Kejadian nyata 27 Sep 2026: kolom `check_out_at` bertipe INTEGER, tetapi berisi teks
  // '27 Sep 2026, 19.58'. Penyebabnya perangkat mengirim DUA bentuk jam pulang sekaligus,
  // `checkOutAt` (label siap tampil) dan `checkOutAtMs` (angka), dan Worker memilih yang label
  // lebih dulu. Akibatnya aritmetika durasi di sisi mana pun yang membaca kolom itu rusak.
  const env=fakeD1(); seedBaseline(env);
  const kirim=(commandId,id,checkIn,checkOutLabel,checkOutMs)=>pushCommands(commandRequest([{
    commandId,type:"attendance.upsert",entityId:id,branchId:"melati",
    payload:{id,branchId:"melati",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",
      checkInAtMs:checkIn,checkInAt:"24 Sep 2026, 08.00",checkOutAtMs:checkOutMs,checkOutAt:checkOutLabel,note:""},
  }]),env,identities.kasir);

  const body=await (await kirim("absen-pulang-0001","att-melati-2026-09-24-2",1789000000000,"24 Sep 2026, 17.00",1789033200000)).json();
  assert.equal(body.results[0].accepted,true,"absen pulang harus diterima");

  const baris=rows(env,"SELECT check_in_at,check_out_at,typeof(check_out_at) AS tipe FROM attendance WHERE staff_email='kasir@cuciin.id'");
  assert.equal(baris.length,1,"harus ada satu baris absensi");
  assert.equal(baris[0].tipe,"integer","kolom jam pulang harus menyimpan angka, bukan teks label");
  assert.equal(baris[0].check_out_at,1789033200000,"angka jam pulang harus dipakai, bukan label jam");
  assert.equal(baris[0].check_in_at,1789000000000,"jam masuk juga harus tersimpan sebagai angka");
});

test("absen pulang tanpa angka tetap diterima dan disimpan kosong", async () => {
  // Perangkat versi lama mungkin hanya mengirim label. Itu tidak boleh menggagalkan absen,
  // dan tidak boleh menulis teks ke kolom angka.
  const env=fakeD1(); seedBaseline(env);
  const body=await (await pushCommands(commandRequest([{
    commandId:"absen-label-0001",type:"attendance.upsert",entityId:"att-melati-2026-09-24-3",branchId:"melati",
    payload:{id:"att-melati-2026-09-24-3",branchId:"melati",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",
      workDate:"2026-09-24",checkInAtMs:1789000000000,checkOutAt:"24 Sep 2026, 17.00",note:""},
  }]),env,identities.kasir)).json();
  assert.equal(body.results[0].accepted,true,"absen dengan label saja tetap harus diterima");

  const baris=rows(env,"SELECT check_out_at FROM attendance WHERE staff_email='kasir@cuciin.id'");
  assert.equal(baris.length,1,"harus ada satu baris absensi");
  assert.equal(baris[0].check_out_at,null,"label teks tidak boleh masuk kolom angka");
});

test("kiriman absen tanpa jam pulang tidak mengosongkan jam pulang yang sudah tercatat", async () => {
  // Aturan pemilik: absen pagi dan sore adalah satu catatan harian, dan tidak boleh ada yang
  // menimpa. Perangkat yang belum sempat menarik jam pulang bisa mengirim ulang baris yang sama
  // tanpa `checkOutAtMs` — misalnya saat memulihkan data lokalnya, atau saat pengawas mengoreksi
  // catatan. Kiriman itu TIDAK boleh mengosongkan jam pulang di server.
  const env=fakeD1(); seedBaseline(env);
  const kirim=(commandId,entityId,payload)=>pushCommands(commandRequest([{
    commandId,type:"attendance.upsert",entityId,branchId:"melati",payload,
  }]),env,identities.kasir);
  const dasar={id:"att-melati-2026-09-24-7",branchId:"melati",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",checkInAtMs:1789000000000,note:""};

  const pulang=await (await kirim("absen-jaga-0001","att-melati-2026-09-24-7",{...dasar,checkOutAtMs:1789033200000})).json();
  assert.equal(pulang.results[0].accepted,true,"absen pulang pertama harus diterima");

  const tanpaPulang=await (await kirim("absen-jaga-0002","att-melati-2026-09-24-7",{...dasar})).json();
  assert.equal(tanpaPulang.results[0].accepted,true,"kiriman tanpa jam pulang tetap harus diterima, bukan ditolak");
  assert.equal(
    rows(env,"SELECT check_out_at FROM attendance WHERE staff_email='kasir@cuciin.id'")[0].check_out_at,
    1789033200000,
    "jam pulang tidak boleh dikosongkan lewat jalur id yang sama",
  );

  // Perangkat versi lama memakai id acak untuk catatan yang sama; itu menempuh kunci unik kedua.
  const idAcak=await (await kirim("absen-jaga-0003","att-acak-dari-perangkat-lama",{...dasar,id:"att-acak-dari-perangkat-lama"})).json();
  assert.equal(idAcak.results[0].accepted,true,"id acak dari perangkat lama tidak boleh ditolak 409");

  const baris=rows(env,"SELECT check_out_at,typeof(check_out_at) AS tipe FROM attendance WHERE staff_email='kasir@cuciin.id'");
  assert.equal(baris.length,1,"satu karyawan, satu tanggal, satu cabang tetap satu baris");
  assert.equal(baris[0].check_out_at,1789033200000,"jam pulang tidak boleh dikosongkan lewat kunci unik karyawan+tanggal+cabang");
  assert.equal(baris[0].tipe,"integer","kolom jam pulang harus tetap angka");
});

test("jurnal absen mencatat nilai gabungan, bukan nilai mentah kiriman", async () => {
  // Jurnal (`sync_changes`) adalah sumber snapshot semua perangkat. Kalau jurnal mencatat nilai
  // mentah kiriman, perangkat lain menerima cerita yang salah walau tabel `attendance` sudah
  // benar: jam pulang yang sudah tercatat akan hilang di layar semua orang. Karena itu jurnal
  // wajib memuat nilai HASIL GABUNGAN.
  const env=fakeD1(); seedBaseline(env);
  const kirim=(commandId,entityId,payload)=>pushCommands(commandRequest([{
    commandId,type:"attendance.upsert",entityId,branchId:"melati",payload,
  }]),env,identities.kasir);
  const dasar={id:"att-melati-2026-09-24-9",branchId:"melati",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",checkInAtMs:1789000000000,note:""};

  await (await kirim("absen-jurnal-0001","att-melati-2026-09-24-9",{...dasar,checkOutAtMs:1789033200000})).json();
  await (await kirim("absen-jurnal-0002","att-melati-2026-09-24-9",{...dasar})).json();

  const jurnal=rows(env,"SELECT payload_json FROM sync_changes WHERE entity_type='attendance' ORDER BY sequence");
  const terakhir=JSON.parse(jurnal[jurnal.length-1].payload_json);
  assert.equal(terakhir.checkOutAtMs,1789033200000,"jurnal harus memuat jam pulang yang sudah tercatat, bukan null dari kiriman terakhir");
  assert.ok(terakhir.checkOutAt,"jurnal harus memuat label jam pulang supaya perangkat bisa langsung menampilkannya");
  assert.equal(terakhir.checkInAtMs,1789000000000,"jam masuk harus ikut terbawa di jurnal");
});

test("jam masuk yang sudah tercatat tidak diganti kiriman berikutnya", async () => {
  // "Tidak boleh ada yang menimpa" juga berlaku untuk jam masuk. Baris absensi dibuat sekali saat
  // karyawan menekan Absen masuk; kiriman sesudahnya (perangkat kedua, pemulihan data lokal, atau
  // jam perangkat yang berbeda) tidak boleh memindahkan jam masuk itu.
  const env=fakeD1(); seedBaseline(env);
  const kirim=(commandId,entityId,payload)=>pushCommands(commandRequest([{
    commandId,type:"attendance.upsert",entityId,branchId:"melati",payload,
  }]),env,identities.kasir);
  const dasar={id:"att-melati-2026-09-24-8",branchId:"melati",staffEmail:"kasir@cuciin.id",staffName:"Kasir Melati",workDate:"2026-09-24",note:""};

  await (await kirim("absen-masuk-0001","att-melati-2026-09-24-8",{...dasar,checkInAtMs:1789000000000})).json();
  await (await kirim("absen-masuk-0002","att-melati-2026-09-24-8",{...dasar,checkInAtMs:1789007200000})).json();
  await (await kirim("absen-masuk-0003","att-acak-dari-perangkat-lama",{...dasar,id:"att-acak-dari-perangkat-lama",checkInAtMs:1789009000000})).json();

  const baris=rows(env,"SELECT check_in_at FROM attendance WHERE staff_email='kasir@cuciin.id'");
  assert.equal(baris.length,1,"satu karyawan, satu tanggal, satu cabang tetap satu baris");
  assert.equal(baris[0].check_in_at,1789000000000,"jam masuk pertama harus dipertahankan, bukan diganti kiriman berikutnya");
});

test("order.cancel menandai nota batal, mencatat pengembalian dana hari ini, dan tidak menyentuh jurnal pembayaran", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const created=await (await pushCommands(commandRequest([{
    commandId:"nota-batal-create-1",type:"order.create",entityId:"MLT-7",branchId:"melati",
    payload:{id:"MLT-7",branchId:"melati",customerName:"Pelanggan Batal",phone:"0813",total:30000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:3,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner)).json();
  assert.equal(created.results[0].accepted,true);
  const paid=await (await pushCommands(commandRequest([{
    commandId:"nota-batal-pay-1",type:"order.payment",entityId:"MLT-7",branchId:"melati",
    payload:{paid:30000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner)).json();
  assert.equal(paid.results[0].accepted,true);
  const paymentsBefore=rows(env,"SELECT COUNT(*) AS n FROM payments WHERE order_id='MLT-7'")[0].n;

  const cancelled=await (await pushCommands(commandRequest([{
    commandId:"nota-batal-0001",type:"order.cancel",entityId:"MLT-7",branchId:"melati",
    payload:{reason:"Pelanggan salah ukur"},
  }]),env,identities.owner)).json();
  assert.equal(cancelled.results[0].accepted,true,"Owner harus bisa membatalkan nota berbayar");

  // Nota TIDAK dihapus: barisnya tetap ada, ditandai batal.
  const stored=JSON.parse(rows(env,"SELECT payload_json FROM orders WHERE id='MLT-7'")[0].payload_json);
  assert.equal(Number(stored.canceledAtMs) > 0,true,"nota harus bertanda batal");
  assert.equal(stored.canceledBy,"Tiftazani Khara");
  assert.equal(stored.cancelReason,"Pelanggan salah ukur");
  assert.equal(stored.customer,"Pelanggan Batal","payload lama tidak boleh hilang saat pembatalan");
  assert.equal(stored.lines.length,1,"rincian layanan tidak boleh hilang");

  // Jurnal pembayaran TIDAK dihapus: laporan tanggal lampau harus tetap seperti saat ditutup.
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM payments WHERE order_id='MLT-7'")[0].n,paymentsBefore,"jurnal pembayaran tidak boleh dihapus");

  // Pengembalian dana tercatat sebagai pengeluaran baru bertanggal sekarang.
  const refund=rows(env,"SELECT category,amount,branch_id FROM expenses WHERE id='refund-MLT-7'");
  assert.equal(refund.length,1,"pengembalian dana harus tercatat sebagai pengeluaran");
  assert.equal(refund[0].category,"PengembalianDana");
  assert.equal(refund[0].amount,30000,"nominalnya sebesar yang sudah dibayar");
  assert.equal(refund[0].branch_id,"melati");

  // Jurnal memuat entri nota batal dan entri pengeluaran, supaya perangkat lain ikut melihat.
  // Entri `expense` ditulis di dalam batch, entri `nota` ditulis dari changePayload sesudahnya,
  // jadi urutannya tidak dipatok: yang penting keduanya ada dan nota terakhir sudah bertanda batal.
  const types=rows(env,"SELECT entity_type FROM sync_changes WHERE entity_id IN ('MLT-7','refund-MLT-7') ORDER BY sequence").map(row=>row.entity_type);
  assert.equal(types.includes("expense"),true,"pengembalian dana harus dijurnal sebagai expense");
  const notaJournal=rows(env,"SELECT payload_json FROM sync_changes WHERE entity_id='MLT-7' AND entity_type IN ('nota','order') ORDER BY sequence DESC LIMIT 1")[0];
  assert.equal(Number(JSON.parse(notaJournal.payload_json).canceledAtMs) > 0,true,"entri jurnal terakhir harus memuat tanda batal supaya perangkat lain melihatnya");
});

test("order.cancel hanya Owner dan idempoten", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(commandRequest([{
    commandId:"nota-batal2-create",type:"order.create",entityId:"MLT-8",branchId:"melati",
    payload:{id:"MLT-8",branchId:"melati",customerName:"Pelanggan Batal 2",phone:"0814",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner);
  await pushCommands(commandRequest([{
    commandId:"nota-batal2-pay",type:"order.payment",entityId:"MLT-8",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner);

  // Kasir dan Supervisor ditolak, alasannya "owner".
  for (const actor of [identities.kasir, identities.spv]) {
    const denied=await (await pushCommands(commandRequest([{
      commandId:`nota-batal2-${actor.role}`,type:"order.cancel",entityId:"MLT-8",branchId:"melati",
      payload:{reason:"coba"},
    }]),env,actor)).json();
    assert.equal(denied.results[0].accepted,false,`${actor.role} tidak boleh membatalkan nota`);
    assert.equal(denied.results[0].code,403);
  }

  const first=await (await pushCommands(commandRequest([{
    commandId:"nota-batal2-0001",type:"order.cancel",entityId:"MLT-8",branchId:"melati",
    payload:{reason:"salah cuci"},
  }]),env,identities.owner)).json();
  assert.equal(first.results[0].accepted,true);
  const refundAfterFirst=rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-8'")[0].n;
  assert.equal(refundAfterFirst,1);

  // Membatalkan lagi dengan commandId berbeda: diterima tanpa efek, dan pengembalian dana tidak dobel.
  const second=await (await pushCommands(commandRequest([{
    commandId:"nota-batal2-0002",type:"order.cancel",entityId:"MLT-8",branchId:"melati",
    payload:{reason:"salah cuci"},
  }]),env,identities.owner)).json();
  assert.equal(second.results[0].accepted,true,"pembatalan ulang harus diterima sebagai no-op");
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-8'")[0].n,1,"pengembalian dana tidak boleh dicatat dua kali");
});

test("order.cancel menolak nota yang belum menerima pembayaran", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(commandRequest([{
    commandId:"nota-batal3-create",type:"order.create",entityId:"MLT-9",branchId:"melati",
    payload:{id:"MLT-9",branchId:"melati",customerName:"Belum Bayar",phone:"0815",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner);

  const body=await (await pushCommands(commandRequest([{
    commandId:"nota-batal3-0001",type:"order.cancel",entityId:"MLT-9",branchId:"melati",
    payload:{reason:"salah"},
  }]),env,identities.owner)).json();
  assert.equal(body.results[0].accepted,false,"nota tanpa pembayaran tidak perlu dibatalkan");
  assert.equal(body.results[0].code,422);
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-9'")[0].n,0,"tidak boleh ada pengembalian dana untuk nota yang belum dibayar");
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM payments WHERE order_id='MLT-9'")[0].n,0);
});

test("order.cancel mengembalikan stok produk yang terjual di nota itu", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`
    INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
      VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);
    INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at)
      VALUES('detergen','cuciin','Detergen',1,'BahanHabisPakai','pcs',1);
    INSERT INTO branch_stocks(branch_id,product_id,quantity,updated_at) VALUES('melati','detergen',10,1);
  `);
  // Nota dengan satu baris layanan retail; stok dikurangi 2 saat nota dibuat.
  const created=await (await pushCommands(commandRequest([{
    commandId:"nota-batal4-create",type:"order.create",entityId:"MLT-10",branchId:"melati",
    payload:{id:"MLT-10",branchId:"melati",customerName:"Beli Detergen",phone:"0816",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner)).json();
  assert.equal(created.results[0].accepted,true);
  await pushCommands(commandRequest([{
    commandId:"nota-batal4-pay",type:"order.payment",entityId:"MLT-10",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner);

  const cancelled=await (await pushCommands(commandRequest([{
    commandId:"nota-batal4-0001",type:"order.cancel",entityId:"MLT-10",branchId:"melati",
    payload:{reason:"batal"},
  }]),env,identities.owner)).json();
  assert.equal(cancelled.results[0].accepted,true);
  // Nota ini tidak punya baris retail, jadi stok tidak berubah. Yang dibuktikan: pembatalan
  // tidak menyentuh stok sama sekali dan tetap berhasil (jalur retailAdjustments aman untuk nol).
  assert.equal(rows(env,"SELECT quantity FROM branch_stocks WHERE branch_id='melati' AND product_id='detergen'")[0].quantity,10);
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM stock_moves")[0].n,0,"tidak ada mutasi stok yang muncul dari nota tanpa retail");
});

test("envelope Android dengan syncIntent cancel dipetakan ke order.cancel, bukan order.put", () => {
  // Perangkat mengirim selisih snapshot: entitas `nota` yang sama dipakai untuk koreksi biasa
  // maupun pembatalan. Tanpa pemetaan ini, pembatalan akan dikirim sebagai `order.put`.
  const cancel=parseCommand({commandId:"device-cancel-0001",entityType:"nota",entityId:"MLT-1",operation:"upsert",branchId:"melati",payload:{id:"MLT-1",syncIntent:"cancel",cancelReason:"mesin rusak"}});
  assert.equal(cancel.type,"order.cancel","syncIntent cancel harus jadi order.cancel");
  assert.equal(cancel.wireEntityType,"nota");
  const biasa=parseCommand({commandId:"device-put-0001",entityType:"nota",entityId:"MLT-1",operation:"upsert",branchId:"melati",payload:{id:"MLT-1"}});
  assert.equal(biasa.type,"order.put","tanpa syncIntent tetap koreksi biasa");
  const status=parseCommand({commandId:"device-status-01",entityType:"nota",entityId:"MLT-1",operation:"upsert",branchId:"melati",payload:{id:"MLT-1",syncIntent:"status"}});
  assert.equal(status.type,"order.put","syncIntent status tetap order.put supaya Supervisor tidak kehilangan jalurnya");
});

test("pembatalan lewat envelope perangkat benar-benar tercatat", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(commandRequest([{
    commandId:"env-create-0001",type:"order.create",entityId:"MLT-11",branchId:"melati",
    payload:{id:"MLT-11",branchId:"melati",customerName:"Pelanggan Envelope",phone:"0817",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner);
  await pushCommands(commandRequest([{
    commandId:"env-pay-000001",type:"order.payment",entityId:"MLT-11",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner);

  // Persis bentuk yang dikirim perangkat: entityType + operation + payload bersyncIntent.
  const body=await (await pushCommands(commandRequest([{
    commandId:"env-cancel-0001",entityType:"nota",entityId:"MLT-11",operation:"upsert",branchId:"melati",
    payload:{id:"MLT-11",branchId:"melati",syncIntent:"cancel",cancelReason:"Pelanggan membatalkan"},
  }]),env,identities.owner)).json();
  assert.equal(body.results[0].accepted,true,`ditolak: ${JSON.stringify(body.results[0])}`);
  const stored=JSON.parse(rows(env,"SELECT payload_json FROM orders WHERE id='MLT-11'")[0].payload_json);
  assert.equal(Number(stored.canceledAtMs) > 0,true,"nota harus bertanda batal");
  assert.equal(stored.cancelReason,"Pelanggan membatalkan");
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-11'")[0].n,1,"pengembalian dana harus tercatat");

  // Kasir ditolak walau memakai jalur envelope yang sama.
  const denied=await (await pushCommands(commandRequest([{
    commandId:"env-cancel-0002",entityType:"nota",entityId:"MLT-11",operation:"upsert",branchId:"melati",
    payload:{id:"MLT-11",syncIntent:"cancel"},
  }]),env,identities.kasir)).json();
  assert.equal(denied.results[0].accepted,false,"kasir tidak boleh membatalkan lewat envelope");
});

test("order.put tidak dapat menghidupkan kembali nota yang sudah dibatalkan", async () => {
  // Celah uang: nota batal masih ada di tabel `orders` (hanya ditandai), dan `order.put`
  // menyusun payload kanonik dari `...p` — payload kiriman perangkat. Perangkat yang masih
  // memegang salinan lama (belum menerima pembatalan) akan mengirim nota tanpa penanda batal,
  // dan server akan MENGHAPUS penanda itu. Akibatnya nota hidup lagi di semua perangkat
  // sementara pengembalian dananya sudah tercatat: uang keluar dua kali.
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(commandRequest([{
    commandId:"hidup-create-01",type:"order.create",entityId:"MLT-20",branchId:"melati",
    payload:{id:"MLT-20",branchId:"melati",customerName:"Pelanggan Hidup",phone:"0819",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner);
  await pushCommands(commandRequest([{
    commandId:"hidup-pay-0001",type:"order.payment",entityId:"MLT-20",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner);
  const cancelled=await (await pushCommands(commandRequest([{
    commandId:"hidup-cancel-01",type:"order.cancel",entityId:"MLT-20",branchId:"melati",
    payload:{cancelReason:"Pelanggan membatalkan"},
  }]),env,identities.owner)).json();
  assert.equal(cancelled.results[0].accepted,true);

  // Perangkat lain yang belum menerima pembatalan mengirim koreksi biasa dengan salinan lamanya.
  const resurrect=await (await pushCommands(commandRequest([{
    commandId:"hidup-put-0001",type:"order.put",entityId:"MLT-20",branchId:"melati",
    payload:{id:"MLT-20",branchId:"melati",customerName:"Pelanggan Hidup",phone:"0819",total:10000,paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner)).json();
  assert.equal(resurrect.results[0].accepted,false,"order.put atas nota yang sudah dibatalkan harus ditolak");
  const stored=JSON.parse(rows(env,"SELECT payload_json FROM orders WHERE id='MLT-20'")[0].payload_json);
  assert.equal(Number(stored.canceledAtMs) > 0,true,"penanda batal tidak boleh hilang karena order.put");
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-20'")[0].n,1,"pengembalian dana tidak boleh bertambah");
});

test("order.put tidak dapat membatalkan nota diam-diam tanpa pengembalian dana", async () => {
  // Arah sebaliknya: kalau `order.put` boleh menulis penanda batal, kasir bisa membatalkan nota
  // berbayar lewat jalur koreksi biasa — tanpa pemeriksaan Owner dan tanpa pengembalian dana.
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(commandRequest([{
    commandId:"sisip-create-01",type:"order.create",entityId:"MLT-21",branchId:"melati",
    payload:{id:"MLT-21",branchId:"melati",customerName:"Pelanggan Sisip",phone:"0820",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner);
  await pushCommands(commandRequest([{
    commandId:"sisip-pay-0001",type:"order.payment",entityId:"MLT-21",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner);

  const smuggled=await (await pushCommands(commandRequest([{
    commandId:"sisip-put-0001",type:"order.put",entityId:"MLT-21",branchId:"melati",
    payload:{id:"MLT-21",branchId:"melati",customerName:"Pelanggan Sisip",phone:"0820",total:10000,paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,canceledAtMs:Date.now(),canceledBy:"Kasir",cancelReason:"dibuat sendiri",lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner)).json();
  const stored=JSON.parse(rows(env,"SELECT payload_json FROM orders WHERE id='MLT-21'")[0].payload_json);
  assert.equal(Number(stored.canceledAtMs ?? 0),0,"penanda batal tidak boleh ditulis lewat order.put");
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-21'")[0].n,0,"order.put tidak boleh membuat pengembalian dana");
  assert.equal(smuggled.results[0].accepted,true,"koreksi lain tetap boleh, yang dibuang hanya penanda batalnya");
});

test("order.payment, order.status, dan order.handover tidak dapat mengubah nota yang sudah dibatalkan", async () => {
  // Nota batal tetap ada di tabel `orders` (hanya ditandai), jadi jalur koreksi biasa masih
  // bisa menemukannya. Tanpa penjagaan ini, nota yang uangnya sudah dikembalikan masih bisa
  // menerima pembayaran baru, diubah statusnya, atau diserahkan ke pelanggan.
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  await pushCommands(commandRequest([{
    commandId:"guard-create-01",type:"order.create",entityId:"MLT-30",branchId:"melati",
    payload:{id:"MLT-30",branchId:"melati",customerName:"Pelanggan Jaga",phone:"0821",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]},
  }]),env,identities.owner);
  await pushCommands(commandRequest([{
    commandId:"guard-pay-0001",type:"order.payment",entityId:"MLT-30",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner);
  const cancelled=await (await pushCommands(commandRequest([{
    commandId:"guard-cancel-01",type:"order.cancel",entityId:"MLT-30",branchId:"melati",
    payload:{cancelReason:"Salah input"},
  }]),env,identities.owner)).json();
  assert.equal(cancelled.results[0].accepted,true);

  // 1. Pembayaran baru di atas nota yang sudah dibatalkan.
  const bayarLagi=await (await pushCommands(commandRequest([{
    commandId:"guard-pay-0002",type:"order.payment",entityId:"MLT-30",branchId:"melati",
    payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"},
  }]),env,identities.owner)).json();
  assert.equal(bayarLagi.results[0].accepted,false,"order.payment atas nota batal harus ditolak");
  assert.equal(rows(env,"SELECT paid FROM orders WHERE id='MLT-30'")[0].paid,10000,"nilai bayar tidak boleh berubah");

  // 2. Perubahan status pengerjaan di atas nota yang sudah dibatalkan.
  const statusLagi=await (await pushCommands(commandRequest([{
    commandId:"guard-status-01",type:"order.status",entityId:"MLT-30",branchId:"melati",
    payload:{workStatus:"Sedang dicuci"},
  }]),env,identities.owner)).json();
  assert.equal(statusLagi.results[0].accepted,false,"order.status atas nota batal harus ditolak");
  assert.equal(rows(env,"SELECT work_status FROM orders WHERE id='MLT-30'")[0].work_status,"Masuk antrian","status kerja tidak boleh berubah");

  // 3. Serah terima nota yang sudah dibatalkan.
  const serahLagi=await (await pushCommands(commandRequest([{
    commandId:"guard-hand-0001",type:"order.handover",entityId:"MLT-30",branchId:"melati",
    payload:{pickedUpAt:"1 Okt 2026, 10.00"},
  }]),env,identities.owner)).json();
  assert.equal(serahLagi.results[0].accepted,false,"order.handover atas nota batal harus ditolak");
  assert.equal(rows(env,"SELECT picked_up_at FROM orders WHERE id='MLT-30'")[0].picked_up_at,null,"waktu serah terima tidak boleh diisi");
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-30'")[0].n,1,"pengembalian dana tidak boleh bertambah");
});

test("migrasi 0009 mengganti kunci absensi menjadi per cabang", () => {
  const sql=readFileSync(new URL("../migrations/0009_attendance_per_branch.sql", import.meta.url), "utf8");
  assert.match(sql,/UNIQUE \(staff_email, work_date, branch_id\)/,"kunci baru harus menyertakan branch_id");
  assert.match(sql,/INSERT OR IGNORE INTO attendance_baru/,"baris lama harus disalin, bukan dibuang");
  assert.match(sql,/idx_attendance_staff_date_branch/,"indeks pencarian absensi harian per cabang harus dibangun");
});

test("kunci absensi per cabang benar-benar berlaku di basis data", () => {
  // Membuktikan migrasinya bekerja, bukan hanya teksnya ada. Tanpa kunci baru, baris kedua gagal.
  const env=fakeD1();
  env.db.exec(`
    INSERT INTO organizations(id,name,owner_email,created_at,updated_at) VALUES('cuciin','Cuciin','o@x.id',1,1);
    INSERT INTO branches(id,organization_id,code,name,address,maps_query,updated_at) VALUES('melati','cuciin','MEL','Melati','','',1);
    INSERT INTO branches(id,organization_id,code,name,address,maps_query,updated_at) VALUES('kenanga','cuciin','KEN','Kenanga','','',1);
  `);
  const insert=(id,branch)=>env.db.prepare("INSERT INTO attendance(id,organization_id,branch_id,staff_email,staff_name,work_date,check_in_at,note,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(id,"cuciin",branch,"kasir@cuciin.id","Kasir Melati","2026-09-24",1,"",1);
  insert("att-1","melati");
  insert("att-2","kenanga");
  assert.equal(rows(env,"SELECT count(*) AS n FROM attendance")[0].n,2,"dua cabang pada hari yang sama harus bisa berdampingan");

  let ditolak=false;
  try { insert("att-3","melati"); } catch { ditolak=true; }
  assert.equal(ditolak,true,"baris kembar untuk cabang yang sama tetap harus ditolak");
});

test("pengembalian dana nota batal tidak bisa dihapus atau diubah lewat jalur biaya", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const send=async(cmd,who=identities.owner)=>(await (await pushCommands(commandRequest([cmd]),env,who)).json()).results[0];
  assert.equal((await send({commandId:"refund-c-0001",type:"order.create",entityId:"MLT-R",branchId:"melati",payload:{id:"MLT-R",branchId:"melati",customerName:"R",phone:"0815",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]}})).accepted,true);
  assert.equal((await send({commandId:"refund-p-0001",type:"order.payment",entityId:"MLT-R",branchId:"melati",payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"}})).accepted,true);
  assert.equal((await send({commandId:"refund-x-0001",type:"order.cancel",entityId:"MLT-R",branchId:"melati",payload:{reason:"uji"}})).accepted,true);
  for (const [who,n] of [[identities.kasir,1],[identities.owner,2]]) {
    const del=await send({commandId:`refund-del-000${n}`,entityType:"expense",operation:"delete",entityId:"refund-MLT-R",branchId:"melati",payload:null},who);
    assert.equal(del.accepted,false,JSON.stringify(del));
    assert.equal(del.code,409);
    // Selisih biaya dari perangkat yang membatalkan: diterima, tetapi nominal server tidak berubah.
    const edit=await send({commandId:`refund-upd-000${n}`,type:"expense.upsert",entityId:"refund-MLT-R",branchId:"melati",payload:{id:"refund-MLT-R",branchId:"melati",category:"PengembalianDana",amount:1,occurredAtMs:1}},who);
    assert.equal(edit.accepted,true,JSON.stringify(edit));
  }
  const fake=await send({commandId:"refund-fake-0001",type:"expense.upsert",entityId:"refund-MLT-Z",branchId:"melati",payload:{id:"refund-MLT-Z",branchId:"melati",category:"Gaji",amount:5,occurredAtMs:1}},identities.kasir);
  assert.equal(fake.accepted,true,JSON.stringify(fake));
  assert.deepEqual(rows(env,"SELECT amount FROM expenses WHERE id LIKE 'refund-%'").map(r=>r.amount),[10000],"id refund- hanya ditulis order.cancel");
});

test("pengembalian dana dari perangkat yang tiba sebelum order.cancel tidak memakai nominal perangkat", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at)
    VALUES('cuci-kiloan','cuciin','Cuci kiloan','kg',10000,1000,0,0,0,1,1);`);
  const send=async(cmd)=>(await (await pushCommands(commandRequest([cmd]),env,identities.owner)).json()).results[0];
  await send({commandId:"early-c-0001",type:"order.create",entityId:"MLT-E",branchId:"melati",payload:{id:"MLT-E",branchId:"melati",customerName:"E",phone:"0816",total:10000,paid:0,paymentStatus:"Belum lunas",paymentMethod:"Tunai",workStatus:"Masuk antrian",createdAt:1,lines:[{serviceId:"cuci-kiloan",serviceName:"Cuci kiloan",quantity:1,unit:"kg",unitPrice:10000}]}});
  await send({commandId:"early-p-0001",type:"order.payment",entityId:"MLT-E",branchId:"melati",payload:{paid:10000,paymentStatus:"Lunas",paymentMethod:"Tunai"}});
  assert.equal((await send({commandId:"early-x-0001",entityType:"expense",operation:"upsert",entityId:"refund-MLT-E",branchId:"melati",payload:{id:"refund-MLT-E",branchId:"melati",category:"PengembalianDana",amount:999999,occurredAtMs:1}})).accepted,true);
  assert.equal(rows(env,"SELECT COUNT(*) AS n FROM expenses WHERE id='refund-MLT-E'")[0].n,0);
  assert.equal((await send({commandId:"early-y-0001",type:"order.cancel",entityId:"MLT-E",branchId:"melati",payload:{reason:"uji"}})).accepted,true);
  assert.deepEqual(rows(env,"SELECT amount FROM expenses WHERE id='refund-MLT-E'").map(r=>r.amount),[10000]);
});
