import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { commandPermission, parseCommand } from "../src/command-sync.ts";

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
