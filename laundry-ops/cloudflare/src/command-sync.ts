export interface CommandEnv { DB: D1Database }
export type SyncIdentity = {
  email: string;
  name: string;
  role: "Owner" | "Kasir" | "Supervisor";
  branchIds: string[];
  bootstrap: boolean;
};

type JsonRecord = Record<string, unknown>;
type SyncCommand = {
  commandId: string;
  type: string;
  entityId?: string;
  branchId?: string;
  expectedUpdatedAt?: number;
  payload: JsonRecord;
  wireEntityType?: string;
};

const ORG_ID = "cuciin";
const MAX_COMMAND_BODY_BYTES = 512_000;
const MAX_COMMANDS = 100;
const MAX_CHANGE_LIMIT = 500;
// Master data tingkat organisasi (tanpa cabang) hanya boleh diubah Owner.
//
// `assetType` sebelumnya tidak ada di daftar ini, padahal `asset_types` tidak punya kolom cabang
// dan aplikasi menjaganya dengan `owner.manage`. Akibatnya Kasir atau Supervisor dapat membuat dan
// MENGHAPUS jenis aset untuk seluruh organisasi. Insiden nyata: perangkat yang berpindah ke akun
// Supervisor menyusun enam `assetType.delete` untuk semua cabang, dan tanpa aturan ini Worker
// menerimanya.
const OWNER_ONLY = new Set(["branch.upsert", "staff.upsert", "service.upsert", "product.upsert", "assetType.upsert", "assetType.delete", "accessRole.upsert", "accessRole.delete", "accessPolicy.upsert", "accessPolicy.delete", "whatsappTemplate.upsert", "whatsappTemplate.delete"]);
const KNOWN_COMMANDS = new Set([
  "order.create", "order.update", "order.put", "order.delete", "order.status", "order.payment", "order.handover",
  "stock.batch", "expense.upsert", "expense.delete", "attendance.upsert", "attendance.delete", "customer.upsert",
  "payment.upsert", "payment.delete",
  "branch.upsert", "branch.delete", "staff.upsert", "staff.delete", "service.upsert", "service.delete", "product.upsert", "product.delete", "customer.delete", "inventory.upsert", "inventory.delete", "assetType.upsert", "assetType.delete", "accessRole.upsert", "accessRole.delete", "accessPolicy.upsert", "accessPolicy.delete", "whatsappTemplate.upsert", "whatsappTemplate.delete",
  "branchStock.put", "branchStock.delete", "stockMove.upsert", "stockMove.delete", "audit.upsert", "audit.delete", "cashClose.upsert", "cashClose.delete",
]);

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function isObject(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function requiredString(row: JsonRecord, key: string, max = 200): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new CommandError(422, `${key} tidak valid`);
  return value.trim();
}
function optionalString(row: JsonRecord, key: string, max = 500): string {
  const value = row[key];
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max) throw new CommandError(422, `${key} tidak valid`);
  return value.trim();
}
function firstString(row:JsonRecord, keys:string[], required=true, max=500):string {
  for(const key of keys) { const value=optionalString(row,key,max); if(value) return value; }
  if(required) throw new CommandError(422,`${keys[0]} tidak valid`);
  return "";
}
function integer(row: JsonRecord, key: string, minimum = 0): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new CommandError(422, `${key} tidak valid`);
  return value;
}
function finiteNumber(row: JsonRecord, key: string, minimum = 0): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) throw new CommandError(422, `${key} tidak valid`);
  return value;
}
function flag(row: JsonRecord, key: string): number { return row[key] === true ? 1 : 0; }
function commandGate(): string { return "EXISTS(SELECT 1 FROM processed_commands WHERE command_id=? AND organization_id=? AND execution_token=? AND result_json IS NULL)"; }

class CommandError extends Error {
  readonly status: number;
  readonly detail?: unknown;
  constructor(status: number, message: string, detail?: unknown) { super(message); this.status=status; this.detail=detail; }
}

export function commandFailureResult(commandId: string, error: unknown): JsonRecord {
  if (error instanceof CommandError && error.status < 500) {
    return { commandId, accepted:false, status:"rejected", code:error.status, error:error.message, detail:error.detail };
  }
  return {
    commandId,
    accepted:false,
    status:"retryable",
    code:error instanceof CommandError ? error.status : 503,
    error:"Command belum dapat diproses; perangkat akan mencoba lagi",
  };
}

export function stockMoveOrderReferenceAllowed(orderExists: boolean, deletedOrderBranchId: string | null, branchId: string, requiresDeletedOrder = false): boolean {
  return requiresDeletedOrder ? !orderExists && deletedOrderBranchId === branchId : orderExists || deletedOrderBranchId === branchId;
}

export function nextEntityVersion(now: number, current?: number | null): number {
  return Math.max(now, (current ?? 0) + 1);
}

export function syncScopeKey(identity: SyncIdentity): string {
  if (identity.bootstrap || identity.role === "Owner") return "owner";
  return `${identity.role.toLowerCase()}:${identity.email.toLowerCase()}:${[...new Set(identity.branchIds)].sort().join(",")}`;
}

export function orderUpsertAllowed(orderExists: boolean, hasDeleteTombstone: boolean): boolean {
  return orderExists || !hasDeleteTombstone;
}

export function canonicalHistoryPayload(payload: JsonRecord, syncId: string, branchId: string, actorField: "by"|"user", actorName: string): JsonRecord {
  return { ...payload, syncId, branchId, [actorField]:actorName };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function parseCommand(raw: unknown): SyncCommand {
  if (!isObject(raw)) throw new CommandError(422, "Command tidak valid");
  const commandId = requiredString(raw, "commandId", 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(commandId)) throw new CommandError(422, "commandId tidak valid");
  const wireEntityType=typeof raw.entityType === "string" ? raw.entityType.trim() : undefined;
  const operation=raw.operation === "delete" ? "delete" : "upsert";
  const aliases:Record<string,string>={branch:"branch",staff:"staff",customer:"customer",service:"service",product:"product",inventory:"inventory",assetType:"assetType",expense:"expense",attendance:"attendance",nota:"order",branchStock:"branchStock",stockMove:"stockMove",audit:"audit",cashClose:"cashClose",payment:"payment",accessRole:"accessRole",accessPolicy:"accessPolicy",whatsappTemplate:"whatsappTemplate"};
  let type=typeof raw.type === "string" ? raw.type.trim() : "";
  if(!type && wireEntityType && aliases[wireEntityType]) type=wireEntityType === "nota" ? (operation === "delete" ? "order.delete" : "order.put") : `${aliases[wireEntityType]}.${operation === "delete" ? "delete" : (wireEntityType === "branchStock" ? "put" : "upsert")}`;
  if(!type) throw new CommandError(422,"type atau entityType wajib diisi");
  if (!KNOWN_COMMANDS.has(type)) throw new CommandError(422, `Tipe command tidak didukung: ${type}`);
  const payload=isObject(raw.payload) ? raw.payload : (operation === "delete" ? {} : null);
  if (!payload) throw new CommandError(422, "payload harus berupa objek");
  const entityId = typeof raw.entityId === "string" ? raw.entityId.trim() : undefined;
  const branchId = typeof raw.branchId === "string" ? raw.branchId.trim() : undefined;
  const expectedUpdatedAt = typeof raw.expectedUpdatedAt === "number" && Number.isSafeInteger(raw.expectedUpdatedAt) ? raw.expectedUpdatedAt : undefined;
  return { commandId, type, entityId, branchId, expectedUpdatedAt, payload, wireEntityType };
}

export function commandPermission(identity: SyncIdentity, type: string, branchId?: string, staffEmail?: string): { allowed: boolean; reason?: string } {
  if (identity.bootstrap) return { allowed:true };
  if ((OWNER_ONLY.has(type) || ["branch.delete","staff.delete","customer.delete","service.delete","product.delete","stockMove.delete","audit.delete","cashClose.delete"].includes(type)) && identity.role !== "Owner") return { allowed:false,reason:"owner" };
  if (type === "order.delete" && identity.role !== "Owner") return { allowed:false,reason:"owner" };
  if (["expense.upsert", "expense.delete", "cashClose.upsert", "cashClose.delete"].includes(type) && identity.role === "Supervisor") return { allowed:false,reason:"role" };
  if (["order.create", "order.update", "order.put", "order.payment", "order.handover"].includes(type) && identity.role === "Supervisor") return { allowed:false,reason:"role" };
  if (["customer.upsert", "customer.delete"].includes(type) && identity.role === "Supervisor") return { allowed:false,reason:"role" };
  if (branchId && identity.role !== "Owner" && !identity.branchIds.includes(branchId)) return { allowed:false,reason:"branch" };
  if (type === "attendance.upsert" && identity.role !== "Owner" && staffEmail?.toLowerCase() !== identity.email.toLowerCase()) return { allowed:false,reason:"self" };
  return { allowed:true };
}

export function attendanceRecordOwnedBy(identity: SyncIdentity, staffEmail: string): boolean {
  return identity.bootstrap || identity.role === "Owner" || staffEmail.toLowerCase() === identity.email.toLowerCase();
}

export function staffJournalScopes(previous: string[], next: string[]): { deletes: string[]; upserts: (string|null)[] } {
  const before=[...new Set(previous)];
  const after=[...new Set(next)];
  return {
    deletes:before.filter(branch=>!after.includes(branch)),
    upserts:after.length ? after : [null],
  };
}

export function trustedCommission(serviceId: string, catalogue: Map<string, number>, historical: Map<string, number> = new Map()): number {
  const value=catalogue.get(serviceId) ?? historical.get(serviceId);
  if(value == null) throw new CommandError(422,`Layanan ${serviceId} tidak tersedia pada katalog`);
  return value;
}

export function cashCloseCreateAllowed(existingBranch: string | null): boolean {
  return existingBranch == null;
}

function assertBranch(identity: SyncIdentity, branchId: string): void {
  if (!branchId) throw new CommandError(422, "branchId wajib diisi");
  if (!identity.bootstrap && identity.role !== "Owner" && !identity.branchIds.includes(branchId)) throw new CommandError(403, "Cabang tidak diizinkan");
}
function assertRole(identity: SyncIdentity, command: SyncCommand): void {
  if(identity.role==="Supervisor" && command.type==="order.put" && command.wireEntityType==="nota") return;
  const staffEmail=command.type==="attendance.upsert" ? optionalString(command.payload,"staffEmail",254) : undefined;
  const permission=commandPermission(identity,command.type,command.branchId,staffEmail);
  if (!permission.allowed) throw new CommandError(403, permission.reason === "owner" ? "Command khusus Owner" : "Role tidak diizinkan");
}

function customAccessRequirement(command: SyncCommand): { module: string; function?: string } | null {
  if (command.type.startsWith("order.")) {
    if (command.payload.syncIntent === "status" || command.type === "order.status") return {module:"queue",function:"queue.status"};
    if (command.payload.waSent === true) return {module:"whatsapp",function:"whatsapp.send"};
    return {module:"service",function:command.type === "order.create" ? "service.create" : "service.correct"};
  }
  if (command.type.startsWith("stock") || command.type.startsWith("branchStock")) return {module:"stock",function:"stock.write"};
  if (command.type.startsWith("attendance")) return {module:"attendance",function:"attendance.write"};
  if (command.type.startsWith("customer")) return {module:"customer"};
  if (command.type.startsWith("payment")) return {module:"service",function:"service.correct"};
  if (command.type.startsWith("inventory")) return {module:"inventory"};
  if (command.type.startsWith("assetType")) return {module:"inventory"};
  if (command.type.startsWith("expense")) return {module:"expense"};
  if (command.type.startsWith("cashClose")) return {module:"cash"};
  if (command.type.startsWith("accessRole")) return {module:"owner",function:"owner.access"};
  return null;
}

/**
 * Apakah email ini memegang fungsi izin tertentu menurut kebijakan akses kustomnya.
 *
 * Dipakai untuk memeriksa izin di sisi server pada hal yang tidak punya modul sendiri, misalnya
 * `service.price`. Owner selalu dianggap boleh; akun tanpa baris kebijakan memakai aturan bawaan
 * peran (dan karena itu diperiksa terpisah oleh pemanggilnya).
 */
async function hasFunction(db: D1Database, email: string, module: string, fn: string): Promise<boolean> {
  const row = await db.prepare("SELECT payload_json FROM access_policies WHERE organization_id=? AND lower(email)=lower(?)").bind(ORG_ID, email).first<{payload_json:string}>();
  if (!row) return false;
  const policy = JSON.parse(row.payload_json) as JsonRecord;
  const modules = Array.isArray(policy.modules) ? policy.modules.filter((value): value is string => typeof value === "string") : [];
  const functions = Array.isArray(policy.functions) ? policy.functions.filter((value): value is string => typeof value === "string") : [];
  return modules.includes(module) && functions.includes(fn);
}

async function assertCustomAccess(db: D1Database, identity: SyncIdentity, command: SyncCommand): Promise<void> {
  if (identity.bootstrap || identity.role === "Owner") return;
  const requirement = customAccessRequirement(command);
  if (!requirement) return;
  const row = await db.prepare("SELECT payload_json FROM access_policies WHERE organization_id=? AND lower(email)=lower(?)").bind(ORG_ID, identity.email).first<{payload_json:string}>();
  if (!row) return;
  const policy = JSON.parse(row.payload_json) as JsonRecord;
  const modules = Array.isArray(policy.modules) ? policy.modules.filter((value): value is string => typeof value === "string") : [];
  const functions = Array.isArray(policy.functions) ? policy.functions.filter((value): value is string => typeof value === "string") : [];
  let requiredFunction = requirement.function;
  if (requirement.module === "service" && requiredFunction === "service.correct") {
    const exists = await db.prepare("SELECT 1 AS found FROM orders WHERE id=? AND organization_id=?").bind(command.entityId ?? "", ORG_ID).first<{found:number}>();
    if (!exists) requiredFunction = "service.create";
  }
  if (!modules.includes(requirement.module) || (requiredFunction && !functions.includes(requiredFunction))) throw new CommandError(403,"Akses fungsi ini dibatasi oleh Owner");
}

async function existingBranchForEntity(db: D1Database, table: string, id: string): Promise<string | null> {
  const row = await db.prepare(`SELECT branch_id FROM ${table} WHERE id=? AND organization_id=?`).bind(id, ORG_ID).first<{branch_id:string}>();
  return row?.branch_id ?? null;
}

function journal(db: D1Database, command: SyncCommand, identity: SyncIdentity, token: string, entityType: string, entityId: string, operation: "upsert"|"delete", branchId: string | null, payload: unknown, now: number): D1PreparedStatement {
  return db.prepare(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id)
    SELECT ?,?,?,?,?,?,?,?,? WHERE ${commandGate()}`)
    .bind(ORG_ID, entityType, entityId, operation, payload == null ? null : JSON.stringify(payload), now, branchId, identity.email.toLowerCase(), command.commandId, command.commandId, ORG_ID, token);
}

function audit(db: D1Database, command: SyncCommand, identity: SyncIdentity, token: string, branchId: string, action: string, orderId: string | null, now: number): D1PreparedStatement {
  return db.prepare(`INSERT INTO audit_logs(id,organization_id,branch_id,actor,action,order_id,occurred_at)
    SELECT ?,?,?,?,?,?,? WHERE ${commandGate()}`)
    .bind(`cmd:${command.commandId}`, ORG_ID, branchId, identity.email.toLowerCase(), action, orderId, now, command.commandId, ORG_ID, token);
}

function guardPreviousMutation(db:D1Database, command:SyncCommand, token:string):D1PreparedStatement {
  return db.prepare(`INSERT INTO sync_command_guards(execution_token,changed_rows) SELECT ?,changes() WHERE ${commandGate()}`)
    .bind(token,command.commandId,ORG_ID,token);
}

type Plan = { statements: D1PreparedStatement[]; entityType: string; entityId: string; branchId: string | null; operation?: "upsert"|"delete"; changePayload?: unknown; updatedAt?: number; journaled?: boolean };

type RetailAdjustment={productId:string;productName:string;delta:number};
async function retailAdjustments(db:D1Database, orderId:string, lines:Array<{serviceId:string;serviceName:string;quantity:number}>):Promise<RetailAdjustment[]> {
  const old=(await db.prepare(`SELECT p.id AS product_id,p.name AS product_name,l.quantity FROM order_lines l JOIN services s ON s.id=l.service_id AND s.organization_id=? JOIN products p ON p.organization_id=? AND (p.id=s.product_id OR p.id=s.id OR p.name=s.name) WHERE l.order_id=? AND s.retail=1`).bind(ORG_ID,ORG_ID,orderId).all<{product_id:string;product_name:string;quantity:number}>()).results;
  const serviceIds=[...new Set(lines.map(line=>line.serviceId))];
  const current=serviceIds.length ? (await db.prepare(`SELECT s.id,p.id AS product_id,p.name AS product_name,s.retail FROM services s LEFT JOIN products p ON p.organization_id=s.organization_id AND (p.id=s.product_id OR p.id=s.id OR p.name=s.name) WHERE s.organization_id=? AND s.id IN (${serviceIds.map(()=>"?").join(",")})`).bind(ORG_ID,...serviceIds).all<{id:string;product_id:string|null;product_name:string|null;retail:number}>()).results : [];
  const catalogue=new Map(current.map(row=>[row.id,row])); const totals=new Map<string,RetailAdjustment>();
  for(const row of old) { const entry=totals.get(row.product_id)??{productId:row.product_id,productName:row.product_name,delta:0}; entry.delta+=Math.ceil(row.quantity); totals.set(row.product_id,entry); }
  for(const line of lines) {
    const service=catalogue.get(line.serviceId); if(!service?.retail) continue;
    if(!service.product_id || !service.product_name) throw new CommandError(422,`Produk untuk layanan retail ${line.serviceName} belum tersedia`);
    if(!Number.isInteger(line.quantity)) throw new CommandError(422,`Jumlah layanan retail ${line.serviceName} harus bilangan bulat`);
    const entry=totals.get(service.product_id)??{productId:service.product_id,productName:service.product_name,delta:0}; entry.delta-=line.quantity; totals.set(service.product_id,entry);
  }
  return [...totals.values()].filter(item=>item.delta!==0);
}

function appendRetailStock(db:D1Database, statements:D1PreparedStatement[], command:SyncCommand, identity:SyncIdentity, token:string, branchId:string, adjustments:RetailAdjustment[], now:number):void {
  for(const item of adjustments) {
    statements.push(db.prepare(`INSERT OR IGNORE INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,0,? WHERE ${commandGate()}`).bind(branchId,item.productId,now,command.commandId,ORG_ID,token));
    statements.push(db.prepare(`UPDATE branch_stocks SET quantity=quantity+?,updated_at=? WHERE branch_id=? AND product_id=? AND ${commandGate()}`).bind(item.delta,now,branchId,item.productId,command.commandId,ORG_ID,token));
    const entityId=`${branchId}:${item.productId}`;
    statements.push(db.prepare(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id) SELECT ?,'branchStock',?,'upsert',json_object('branchId',?,'productKey',?,'stock',(SELECT quantity FROM branch_stocks WHERE branch_id=? AND product_id=?)),?,?,?,? WHERE ${commandGate()}`).bind(ORG_ID,entityId,branchId,item.productId,branchId,item.productId,now,branchId,identity.email.toLowerCase(),command.commandId,command.commandId,ORG_ID,token));
  }
}

async function planOrder(db: D1Database, command: SyncCommand, identity: SyncIdentity, token: string, now: number): Promise<Plan> {
  const p = command.payload;
  const id = command.entityId || requiredString(p, "id", 100);
  const existing = await db.prepare("SELECT * FROM orders WHERE id=? AND organization_id=?").bind(id, ORG_ID).first<{branch_id:string;updated_at:number;cashier_email:string;cashier_name:string;customer_name:string;phone:string;total:number;paid:number;payment_status:string;payment_method:string;work_status:string;created_at:number;estimated_finish:string;completed_at:string|null;picked_up_at:string|null;wa_sent:number;payload_json:string|null}>();
  now=nextEntityVersion(now,existing?.updated_at);
  const branchId = command.branchId || optionalString(p, "branchId", 100) || existing?.branch_id || "";
  assertBranch(identity, branchId);
  if (existing) assertBranch(identity, existing.branch_id);
  if (existing?.wa_sent === 1 && identity.role !== "Owner" && command.type === "order.put") throw new CommandError(403, "Service sudah dikirim ke pelanggan; hanya Owner yang dapat mengoreksi");
  if(!existing && ["order.create","order.put"].includes(command.type)) {
    const tombstone=await db.prepare("SELECT 1 AS deleted FROM sync_changes WHERE organization_id=? AND entity_type IN ('nota','order') AND entity_id=? AND operation='delete' LIMIT 1").bind(ORG_ID,id).first<{deleted:number}>();
    if(!orderUpsertAllowed(false,Boolean(tombstone))) throw new CommandError(409,"Service sudah dihapus dan tidak dapat dipulihkan tanpa proses restore Owner");
  }
  if (command.expectedUpdatedAt != null && existing?.updated_at !== command.expectedUpdatedAt) throw new CommandError(409, "Service sudah berubah di perangkat lain", { updatedAt: existing?.updated_at ?? null });
  const gate = commandGate();
  const statements: D1PreparedStatement[] = [];

  if(command.type==="order.put" && identity.role==="Supervisor") {
    if(!existing) throw new CommandError(403,"Supervisor hanya dapat mengubah status pengerjaan");
    const status=requiredString(p,"laundry",80);
    const storedLines=(await db.prepare("SELECT service_id,service_name,quantity,unit,unit_price,handler_email,handler_name,commission_per_unit FROM order_lines WHERE order_id=? ORDER BY line_no").bind(id).all<{service_id:string;service_name:string;quantity:number;unit:string;unit_price:number;handler_email:string;handler_name:string;commission_per_unit:number}>()).results;
    const storedPayload=existing.payload_json ? JSON.parse(existing.payload_json) as JsonRecord : null;
    if(storedPayload) {
      const mutable=new Set(["laundry","completedAt","updatedAtMs","photos","syncIntent"]);
      const immutable=(value:JsonRecord)=>Object.fromEntries(Object.entries(value).filter(([key])=>!mutable.has(key)));
      if(stable(immutable(storedPayload))!==stable(immutable(p))) throw new CommandError(403,"Supervisor hanya dapat mengubah status pengerjaan");
    }
    const canonical={...(storedPayload ?? {}),id,branchId:existing.branch_id,kasir:existing.cashier_name,customer:existing.customer_name,phone:existing.phone,items:typeof p.items==="string"?p.items:storedLines.map(line=>line.service_name).join(", "),total:existing.total,paid:existing.paid,pay:existing.payment_status,laundry:status,createdAt:typeof p.createdAt==="string"?p.createdAt:String(existing.created_at),createdAtMs:existing.created_at,pickupAt:existing.estimated_finish,waSent:existing.wa_sent===1,photos:[],payMethod:existing.payment_method,completedAt:p.completedAt ?? null,pickedUpAt:existing.picked_up_at,lines:storedLines.map(line=>({serviceId:line.service_id,name:line.service_name,qty:line.quantity,unit:line.unit,unitPrice:line.unit_price,handledByEmail:line.handler_email,handledByName:line.handler_name,commissionPerUnit:line.commission_per_unit})),kasirEmail:existing.cashier_email,updatedAtMs:now};
    delete (canonical as JsonRecord).syncIntent;
    statements.push(db.prepare(`UPDATE orders SET work_status=?,completed_at=?,updated_at=?,payload_json=? WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(status,p.completedAt ?? null,now,JSON.stringify(canonical),id,ORG_ID,existing.updated_at,command.commandId,ORG_ID,token));
    statements.push(guardPreviousMutation(db,command,token));
    statements.push(audit(db,command,identity,token,branchId,"Mengubah status pengerjaan",id,now));
    return {statements,entityType:"nota",entityId:id,branchId,changePayload:canonical,updatedAt:now};
  }

  if (command.type === "order.delete") {
    // Nota yang belum pernah sampai ke server (dibuat lalu dihapus saat offline, atau
    // sudah hilang di sisi server) sudah sesuai maksud command. Menolaknya 404 membuat
    // perangkat menyimpan command yang tidak akan pernah berhasil dan menahan antreannya.
    if (!existing) return { statements: [], entityType: command.wireEntityType ?? "order", entityId: id, branchId, operation: "delete", changePayload: null, updatedAt: now };
    if (existing.paid > 0) throw new CommandError(422, "Service yang sudah menerima pembayaran tidak dapat dihapus. Catat pengembalian dana terlebih dahulu.");
    const adjustments=await retailAdjustments(db,id,[]);
    statements.push(db.prepare(`DELETE FROM orders WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(id, ORG_ID, existing.updated_at, command.commandId, ORG_ID, token));
    statements.push(guardPreviousMutation(db,command,token));
    appendRetailStock(db,statements,command,identity,token,branchId,adjustments,now);
    statements.push(audit(db, command, identity, token, branchId, "Menghapus Service", id, now));
    return { statements, entityType: command.wireEntityType ?? "order", entityId: id, branchId, operation: "delete", changePayload: null, updatedAt:now };
  }

  if (["order.status", "order.payment", "order.handover"].includes(command.type)) {
    if (!existing) throw new CommandError(404, "Service tidak ditemukan");
    // Snapshot materializer mengganti seluruh entity saat upsert, jadi payload parsial
    // akan menghapus field lain. Susun ulang payload lengkap dari baris tersimpan.
    const storedPayload=existing.payload_json ? JSON.parse(existing.payload_json) as JsonRecord : null;
    const storedLines=(await db.prepare("SELECT service_id,service_name,quantity,unit,unit_price,handler_email,handler_name,commission_per_unit FROM order_lines WHERE order_id=? ORDER BY line_no").bind(id).all<{service_id:string;service_name:string;quantity:number;unit:string;unit_price:number;handler_email:string;handler_name:string;commission_per_unit:number}>()).results;
    const canonicalFull:JsonRecord={...(storedPayload ?? {}),id,branchId:existing.branch_id,kasirEmail:existing.cashier_email,kasir:existing.cashier_name,customer:existing.customer_name,phone:existing.phone,total:existing.total,paid:existing.paid,pay:existing.payment_status,laundry:existing.work_status,payMethod:existing.payment_method,createdAt:typeof storedPayload?.createdAt==="string"?storedPayload.createdAt:String(existing.created_at),createdAtMs:existing.created_at,pickupAt:existing.estimated_finish,completedAt:existing.completed_at,pickedUpAt:existing.picked_up_at,waSent:existing.wa_sent===1,photos:[],lines:storedLines.map(line=>({serviceId:line.service_id,name:line.service_name,qty:line.quantity,unit:line.unit,unitPrice:line.unit_price,handledByEmail:line.handler_email,handledByName:line.handler_name,commissionPerUnit:line.commission_per_unit})),updatedAtMs:now};
    delete (canonicalFull as JsonRecord).syncIntent;
    if (command.type === "order.status") {
      const status = requiredString(p, "workStatus", 80);
      canonicalFull.laundry=status; canonicalFull.completedAt=p.completedAt ?? null;
      statements.push(db.prepare(`UPDATE orders SET work_status=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(status, p.completedAt ?? null, now, id, ORG_ID, existing.updated_at, command.commandId, ORG_ID, token));
    } else if (command.type === "order.payment") {
      const paid = integer(p, "paid");
      if (paid > existing.total) throw new CommandError(422,"Pembayaran melebihi grand total");
      if (paid < existing.paid) throw new CommandError(422,"Pembayaran tercatat tidak dapat dikurangi tanpa pengembalian dana");
      const status = requiredString(p, "paymentStatus", 50);
      const method = requiredString(p, "paymentMethod", 50);
      canonicalFull.paid=paid; canonicalFull.pay=status; canonicalFull.payMethod=method;
      statements.push(db.prepare(`UPDATE orders SET paid=?,payment_status=?,payment_method=?,updated_at=? WHERE id=? AND organization_id=? AND updated_at=? AND ?<=total AND ${gate}`).bind(paid,status,method,now,id,ORG_ID,existing.updated_at,paid,command.commandId,ORG_ID,token));
    } else {
      const pickedUpAt = requiredString(p, "pickedUpAt", 80);
      canonicalFull.pickedUpAt=pickedUpAt;
      statements.push(db.prepare(`UPDATE orders SET picked_up_at=?,updated_at=? WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(pickedUpAt,now,id,ORG_ID,existing.updated_at,command.commandId,ORG_ID,token));
    }
    statements.push(db.prepare(`UPDATE orders SET payload_json=? WHERE id=? AND organization_id=? AND ${gate}`).bind(JSON.stringify(canonicalFull),id,ORG_ID,command.commandId,ORG_ID,token));
    statements.push(guardPreviousMutation(db,command,token));
    statements.push(audit(db, command, identity, token, branchId, command.type, id, now));
    return { statements, entityType: command.wireEntityType ?? "nota", entityId: id, branchId, changePayload: canonicalFull, updatedAt:now };
  }

  const linesRaw = p.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length < 1 || linesRaw.length > 80) throw new CommandError(422, "Service harus memiliki 1–80 rincian");
  const parsedLines = linesRaw.map((raw, index) => {
    if (!isObject(raw)) throw new CommandError(422, `Rincian ${index + 1} tidak valid`);
    const handlerEmail = identity.role === "Owner" || identity.bootstrap ? firstString(raw,["handlerEmail","handledByEmail"],false,254).toLowerCase() : identity.email.toLowerCase();
    const handlerName = identity.role === "Owner" || identity.bootstrap ? firstString(raw,["handlerName","handledByName"],false,160) : identity.name;
    return {
      serviceId: requiredString(raw,"serviceId",100), serviceName: firstString(raw,["serviceName","name"],true,200), quantity: typeof raw.quantity === "number" ? finiteNumber(raw,"quantity",0.001) : finiteNumber(raw,"qty",0.001),
      unit: requiredString(raw,"unit",40), unitPrice: integer(raw,"unitPrice"), handlerEmail, handlerName,
    };
  });
  const serviceIds=[...new Set(parsedLines.map(line=>line.serviceId))];
  const commissions=(await db.prepare(`SELECT id,commission_per_unit,default_price FROM services WHERE organization_id=? AND active=1 AND id IN (${serviceIds.map(()=>"?").join(",")})`).bind(ORG_ID,...serviceIds).all<{id:string;commission_per_unit:number;default_price:number}>()).results;
  const commissionCatalogue=new Map(commissions.map(row=>[row.id,row.commission_per_unit]));
  const priceCatalogue=new Map(commissions.map(row=>[row.id,row.default_price]));
  const storedCommissions=existing ? (await db.prepare(`SELECT service_id,commission_per_unit,unit_price FROM order_lines WHERE order_id=? AND service_id IN (${serviceIds.map(()=>"?").join(",")})`).bind(id,...serviceIds).all<{service_id:string;commission_per_unit:number;unit_price:number}>()).results : [];
  const historicalCommissions=new Map(storedCommissions.map(row=>[row.service_id,row.commission_per_unit]));
  const historicalPrices=new Map(storedCommissions.map(row=>[row.service_id,row.unit_price]));
  const lines=parsedLines.map(line=>({...line,commissionPerUnit:trustedCommission(line.serviceId,commissionCatalogue,historicalCommissions)}));
  // Harga per satuan hanya boleh berbeda dari harga katalog bila pengirimnya memang pemegang
  // fungsi `service.price` (bawaannya Owner). Tanpa pemeriksaan ini, perangkat yang dimodifikasi
  // bisa menulis harga apa pun ke server walau tombolnya disembunyikan di UI.
  if (identity.role !== "Owner" && !identity.bootstrap) {
    const bolehUbahHarga = await hasFunction(db, identity.email, "service", "service.price");
    if (!bolehUbahHarga) {
      const menyimpang = lines.find(line => {
        const katalog = priceCatalogue.get(line.serviceId);
        if (typeof katalog !== "number" || line.unitPrice === katalog) return false;
        // Harga yang sudah tersimpan pada Service ini tetap boleh dipertahankan, supaya koreksi
        // rincian lain tidak ikut ditolak hanya karena ada harga Service dari transaksi sebelumnya.
        return line.unitPrice !== historicalPrices.get(line.serviceId);
      });
      if (menyimpang) throw new CommandError(403, "Harga Service hanya dapat diubah oleh Owner");
    }
  }
  const total = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);
  const stockAdjustments=await retailAdjustments(db,id,lines);
  const paid = integer(p,"paid");
  if (paid > total) throw new CommandError(422, "Pembayaran melebihi grand total");
  if (existing && paid < existing.paid) throw new CommandError(422, "Pembayaran tercatat tidak dapat dikurangi tanpa pengembalian dana");
  const cashierEmail = identity.role === "Owner" || identity.bootstrap ? (firstString(p,["cashierEmail","kasirEmail"],false,254).toLowerCase() || identity.email.toLowerCase()) : identity.email.toLowerCase();
  const cashierName = identity.role === "Owner" || identity.bootstrap ? (firstString(p,["cashierName","kasir"],false,160) || identity.name) : identity.name;
  const canonicalLines=lines.map(line=>({serviceId:line.serviceId,name:line.serviceName,qty:line.quantity,unit:line.unit,unitPrice:line.unitPrice,handledByEmail:line.handlerEmail,handledByName:line.handlerName,commissionPerUnit:line.commissionPerUnit}));
  const canonical = command.wireEntityType === "nota" ? { ...p,id,branchId,kasirEmail:cashierEmail,kasir:cashierName,total,lines:canonicalLines,photos:[],updatedAtMs:now } : { ...p, id, branchId, cashierEmail, cashierName, total, lines, updatedAt: now };
  const customerName=firstString(p,["customerName","customer"],true,200);
  const paymentStatus=firstString(p,["paymentStatus","pay"],true,50);
  const paymentMethod=firstString(p,["paymentMethod","payMethod"],true,50);
  const workStatus=firstString(p,["workStatus","laundry"],true,80);
  const createdAt=typeof p.createdAt === "number" ? integer(p,"createdAt",1) : integer(p,"createdAtMs",1);
  const estimatedFinish=firstString(p,["estimatedFinish","pickupAt"],false,80);
  const values = [id,ORG_ID,branchId,cashierEmail,cashierName,customerName,optionalString(p,"phone",40),total,paid,paymentStatus,paymentMethod,workStatus,createdAt,estimatedFinish,p.completedAt ?? null,p.pickedUpAt ?? null,flag(p,"waSent"),now,JSON.stringify(canonical)];
  if (command.type === "order.create" || (command.type === "order.put" && !existing)) {
    if (existing) throw new CommandError(409, "ID Service sudah digunakan");
    statements.push(db.prepare(`INSERT INTO orders(id,organization_id,branch_id,cashier_email,cashier_name,customer_name,phone,total,paid,payment_status,payment_method,work_status,created_at,estimated_finish,completed_at,picked_up_at,wa_sent,updated_at,payload_json)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${gate}`).bind(...values,command.commandId,ORG_ID,token));
    statements.push(guardPreviousMutation(db,command,token));
  } else {
    if (!existing) throw new CommandError(404, "Service tidak ditemukan");
    statements.push(db.prepare(`UPDATE orders SET branch_id=?,cashier_email=?,cashier_name=?,customer_name=?,phone=?,total=?,paid=?,payment_status=?,payment_method=?,work_status=?,created_at=?,estimated_finish=?,completed_at=?,picked_up_at=?,wa_sent=?,updated_at=?,payload_json=? WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`)
      .bind(branchId,cashierEmail,cashierName,values[5],values[6],total,paid,values[9],values[10],values[11],values[12],values[13],values[14],values[15],values[16],now,JSON.stringify(canonical),id,ORG_ID,existing.updated_at,command.commandId,ORG_ID,token));
    statements.push(guardPreviousMutation(db,command,token));
    statements.push(db.prepare(`DELETE FROM order_lines WHERE order_id=? AND ${gate}`).bind(id,command.commandId,ORG_ID,token));
  }
  lines.forEach((line,index) => statements.push(db.prepare(`INSERT INTO order_lines(order_id,service_id,line_no,service_name,quantity,unit,unit_price,handler_email,handler_name,commission_per_unit)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${gate}`).bind(id,line.serviceId,index,line.serviceName,line.quantity,line.unit,line.unitPrice,line.handlerEmail,line.handlerName,line.commissionPerUnit,command.commandId,ORG_ID,token)));
  appendRetailStock(db,statements,command,identity,token,branchId,stockAdjustments,now);
  statements.push(audit(db,command,identity,token,branchId,command.type,id,now));
  return { statements, entityType:command.wireEntityType ?? "order", entityId:id, branchId, changePayload:canonical, updatedAt:now };
}

async function planStock(db: D1Database, command: SyncCommand, identity: SyncIdentity, token: string, now: number): Promise<Plan> {
  const branchId = command.branchId || requiredString(command.payload,"branchId",100);
  assertBranch(identity,branchId);
  const raw = command.payload.items;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) throw new CommandError(422,"items harus berisi 1–20 produk");
  const items = raw.map((value,index) => {
    if (!isObject(value)) throw new CommandError(422,`Item stok ${index + 1} tidak valid`);
    const mode = requiredString(value,"mode",10);
    if (!['delta','set'].includes(mode)) throw new CommandError(422,"Mode stok harus delta atau set");
    const quantity = integer(value,"quantity",mode === "delta" ? -1_000_000 : 0);
    if (mode === "delta" && quantity === 0) throw new CommandError(422,"Delta stok tidak boleh nol");
    return { productId:requiredString(value,"productId",100), productName:optionalString(value,"productName",200), mode, quantity, note:optionalString(value,"note",500) };
  });
  if (new Set(items.map(item=>item.productId)).size !== items.length) throw new CommandError(422,"Produk dalam satu batch tidak boleh duplikat");
  const statements:D1PreparedStatement[]=[];
  for (const item of items) {
    if (item.mode === "delta") {
      statements.push(db.prepare(`INSERT OR IGNORE INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,0,? WHERE ${commandGate()}`).bind(branchId,item.productId,now,command.commandId,ORG_ID,token));
      statements.push(db.prepare(`UPDATE branch_stocks SET quantity=quantity+?,updated_at=? WHERE branch_id=? AND product_id=? AND ${commandGate()}`).bind(item.quantity,now,branchId,item.productId,command.commandId,ORG_ID,token));
    } else {
      statements.push(db.prepare(`INSERT INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,?,? WHERE ${commandGate()}
        ON CONFLICT(branch_id,product_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at`)
        .bind(branchId,item.productId,item.quantity,now,command.commandId,ORG_ID,token));
    }
    const moveId=`${command.commandId}:${item.productId}`;
    const payload={ id:moveId,branchId,productId:item.productId,product:item.productName,kind:item.mode,qty:item.quantity,by:identity.email.toLowerCase(),note:item.note,atMs:now };
    statements.push(db.prepare(`INSERT INTO stock_moves(id,organization_id,branch_id,payload_json,occurred_at,updated_at)
      SELECT ?,?,?,?,?,? WHERE ${commandGate()}`).bind(moveId,ORG_ID,branchId,JSON.stringify(payload),now,now,command.commandId,ORG_ID,token));
    // Riwayat stok dan saldo dijurnal sebagai entity yang dikenal materializer snapshot.
    // Tipe "stock" tidak ada di CHANGE_DATASETS sehingga perubahan tidak sampai ke perangkat.
    statements.push(db.prepare(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id)
      SELECT ?,'stockMove',?,'upsert',?,?,?,?,? WHERE ${commandGate()}`).bind(ORG_ID,moveId,JSON.stringify(payload),now,branchId,identity.email.toLowerCase(),command.commandId,command.commandId,ORG_ID,token));
    const balanceId=`${branchId}:${item.productId}`;
    statements.push(db.prepare(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id)
      SELECT ?,'branchStock',?,'upsert',json_object('branchId',?,'productKey',?,'stock',(SELECT quantity FROM branch_stocks WHERE branch_id=? AND product_id=?)),?,?,?,? WHERE ${commandGate()}`).bind(ORG_ID,balanceId,branchId,item.productId,branchId,item.productId,now,branchId,identity.email.toLowerCase(),command.commandId,command.commandId,ORG_ID,token));
  }
  statements.push(audit(db,command,identity,token,branchId,`Stok batch: ${items.length} produk`,null,now));
  return { statements,entityType:"stock-batch",entityId:command.commandId,branchId,changePayload:null };
}

async function planStockMove(db:D1Database, command:SyncCommand, identity:SyncIdentity, token:string, now:number):Promise<Plan> {
  const p=command.payload; const branchId=command.branchId || requiredString(p,"branchId",100); assertBranch(identity,branchId);
  const moveId=command.entityId || requiredString(p,"id",100);
  if(command.type.endsWith(".delete")) {
    const existing=await db.prepare("SELECT branch_id FROM stock_moves WHERE id=? AND organization_id=?").bind(moveId,ORG_ID).first<{branch_id:string}>();
    if(!existing) throw new CommandError(404,"Riwayat stok tidak ditemukan"); assertBranch(identity,existing.branch_id);
    return {statements:[db.prepare(`DELETE FROM stock_moves WHERE id=? AND organization_id=? AND ${commandGate()}`).bind(moveId,ORG_ID,command.commandId,ORG_ID,token)],entityType:"stockMove",entityId:moveId,branchId:existing.branch_id,operation:"delete",changePayload:null};
  }
  const productRef=requiredString(p,"product",200);
  const product=await db.prepare("SELECT id,name FROM products WHERE organization_id=? AND (id=? OR name=?) LIMIT 1").bind(ORG_ID,productRef,productRef).first<{id:string;name:string}>();
  if(!product) throw new CommandError(422,"Produk stok tidak ditemukan");
  const kind=requiredString(p,"kind",20); const qty=integer(p,"qty",-1_000_000);
  const isSet=kind==="Update";
  const delta=kind==="Tambah" ? Math.abs(qty) : (["Kurang","Jual"].includes(kind) ? -Math.abs(qty) : qty);
  const target=isSet ? (typeof p.balanceAfter === "number" ? integer(p,"balanceAfter") : integer(p,"qty")) : delta;
  const statements:D1PreparedStatement[]=[];
  const orderId=typeof p.notaId === "string"&&p.notaId ? p.notaId : null;
  if(orderId) {
    const order=await db.prepare("SELECT id FROM orders WHERE id=? AND organization_id=? AND branch_id=?").bind(orderId,ORG_ID,branchId).first();
    const deletedOrder=!order ? await db.prepare("SELECT branch_id FROM sync_changes WHERE organization_id=? AND entity_type IN ('nota','order') AND entity_id=? AND operation='delete' ORDER BY sequence DESC LIMIT 1").bind(ORG_ID,orderId).first<{branch_id:string|null}>() : null;
    if(!stockMoveOrderReferenceAllowed(Boolean(order),deletedOrder?.branch_id ?? null,branchId,p.requiresDeletedNota===true)) throw new CommandError(409,p.requiresDeletedNota===true ? "Penghapusan Service belum berhasil; kompensasi stok ditunda" : "Service asal mutasi stok belum tersimpan");
  } else if(isSet) statements.push(db.prepare(`INSERT INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,?,? WHERE ${commandGate()} ON CONFLICT(branch_id,product_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at`).bind(branchId,product.id,target,now,command.commandId,ORG_ID,token));
  else {
    statements.push(db.prepare(`INSERT OR IGNORE INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,0,? WHERE ${commandGate()}`).bind(branchId,product.id,now,command.commandId,ORG_ID,token));
    statements.push(db.prepare(`UPDATE branch_stocks SET quantity=quantity+?,updated_at=? WHERE branch_id=? AND product_id=? AND ${commandGate()}`).bind(target,now,branchId,product.id,command.commandId,ORG_ID,token));
  }
  const canonical=canonicalHistoryPayload(p,moveId,branchId,"by",identity.name);
  statements.push(db.prepare(`INSERT INTO stock_moves(id,organization_id,branch_id,payload_json,occurred_at,updated_at) SELECT ?,?,?,json_set(?,'$.balanceAfter',(SELECT quantity FROM branch_stocks WHERE branch_id=? AND product_id=?)),?,? WHERE ${commandGate()}`).bind(moveId,ORG_ID,branchId,JSON.stringify(canonical),branchId,product.id,typeof p.atMs === "number" ? p.atMs : now,now,command.commandId,ORG_ID,token));
  statements.push(db.prepare(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id) SELECT ?,'stockMove',?,'upsert',json_set(?,'$.balanceAfter',(SELECT quantity FROM branch_stocks WHERE branch_id=? AND product_id=?)),?,?,?,? WHERE ${commandGate()}`).bind(ORG_ID,moveId,JSON.stringify(canonical),branchId,product.id,now,branchId,identity.email.toLowerCase(),command.commandId,command.commandId,ORG_ID,token));
  const balanceId=`${branchId}:${product.id}`;
  statements.push(db.prepare(`INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id) SELECT ?,'branchStock',?,'upsert',json_object('branchId',?,'productKey',?,'stock',(SELECT quantity FROM branch_stocks WHERE branch_id=? AND product_id=?)),?,?,?,? WHERE ${commandGate()}`).bind(ORG_ID,balanceId,branchId,product.id,branchId,product.id,now,branchId,identity.email.toLowerCase(),command.commandId,command.commandId,ORG_ID,token));
  statements.push(audit(db,command,identity,token,branchId,`Stok ${kind}: ${product.name}`,typeof p.notaId === "string" ? p.notaId : null,now));
  return {statements,entityType:"stock-batch",entityId:moveId,branchId,changePayload:null};
}

async function planRawOperational(db:D1Database, command:SyncCommand, identity:SyncIdentity, token:string, now:number):Promise<Plan> {
  const p=command.payload; const branchId=command.branchId || requiredString(p,"branchId",100); assertBranch(identity,branchId);
  const id=command.entityId || requiredString(p,"id",100); const deleting=command.type.endsWith(".delete"); const statements:D1PreparedStatement[]=[];
  if(command.wireEntityType==="audit") {
    if(deleting) return {statements:[db.prepare(`DELETE FROM audit_logs WHERE id=? AND organization_id=? AND ${commandGate()}`).bind(id,ORG_ID,command.commandId,ORG_ID,token)],entityType:"audit",entityId:id,branchId,operation:"delete",changePayload:null};
    const collision=await db.prepare("SELECT 1 AS found FROM audit_logs WHERE id=? AND organization_id=?").bind(id,ORG_ID).first<{found:number}>();
    if(collision) throw new CommandError(409,"ID audit sudah digunakan");
    const actor=identity.email.toLowerCase();
    statements.push(db.prepare(`INSERT INTO audit_logs(id,organization_id,branch_id,actor,action,order_id,occurred_at) SELECT ?,?,?,?,?,?,? WHERE ${commandGate()}`).bind(id,ORG_ID,branchId,actor,requiredString(p,"action",500),typeof p.notaId === "string" ? p.notaId : null,typeof p.atMs === "number" ? p.atMs : now,command.commandId,ORG_ID,token));
    return {statements,entityType:"audit",entityId:id,branchId,changePayload:canonicalHistoryPayload(p,id,branchId,"user",identity.name)};
  }
  if(command.wireEntityType==="cashClose") {
    const existingBranch=await existingBranchForEntity(db,"cash_closes",id);
    if(!deleting && !cashCloseCreateAllowed(existingBranch)) throw new CommandError(409,"ID tutup kas sudah digunakan");
    if(existingBranch) assertBranch(identity,existingBranch);
    if(deleting) statements.push(db.prepare(`DELETE FROM cash_closes WHERE id=? AND organization_id=? AND ${commandGate()}`).bind(id,ORG_ID,command.commandId,ORG_ID,token));
    else {
      statements.push(db.prepare(`INSERT INTO cash_closes(id,organization_id,branch_id,payload_json,occurred_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${commandGate()}`).bind(id,ORG_ID,branchId,JSON.stringify({...p,id,branchId,by:identity.name}),typeof p.atMs === "number" ? p.atMs : now,now,command.commandId,ORG_ID,token));
      statements.push(guardPreviousMutation(db,command,token));
    }
    return {statements,entityType:"cashClose",entityId:id,branchId,operation:deleting?"delete":"upsert",changePayload:deleting?null:{...p,id,branchId,by:identity.name}};
  }
  throw new CommandError(422,"Entity operasional tidak didukung");
}

async function planDerivedStock(db:D1Database, command:SyncCommand, identity:SyncIdentity, token:string):Promise<Plan> {
  const p=command.payload; const branchId=command.branchId || optionalString(p,"branchId",100) || command.entityId?.split(":")[0] || ""; assertBranch(identity,branchId);
  const productId=optionalString(p,"productKey",100) || command.entityId?.slice(branchId.length+1) || "";
  if(command.type.endsWith(".delete")) {
    if(!productId) throw new CommandError(422,"productKey wajib diisi");
    return {statements:[db.prepare(`DELETE FROM branch_stocks WHERE branch_id=? AND product_id=? AND ${commandGate()}`).bind(branchId,productId,command.commandId,ORG_ID,token)],entityType:"branchStock",entityId:command.entityId || `${branchId}:${productId}`,branchId,operation:"delete",changePayload:null};
  }
  // Saldo adalah proyeksi stockMove. Command absolut ini diakui agar outbox
  // tidak macet, tetapi tidak boleh menimpa delta dari perangkat lain.
  return {statements:[],entityType:"derived-noop",entityId:command.entityId || `${branchId}:${productId}`,branchId,changePayload:null};
}

async function planPayment(db:D1Database, command:SyncCommand, identity:SyncIdentity, token:string, now:number):Promise<Plan> {
  const p=command.payload;
  const id=command.entityId || requiredString(p,"id",100);
  if(command.type==="payment.delete") {
    const existing=await db.prepare("SELECT order_id,branch_id FROM payments WHERE id=? AND organization_id=?").bind(id,ORG_ID).first<{order_id:string;branch_id:string}>();
    // Pembayaran yang sudah tidak ada dianggap selesai. Command dari perangkat bisa
    // terkirim ulang setelah barisnya hilang, dan menolaknya akan menahan antrean.
    if(!existing) return {statements:[],entityType:"payment",entityId:id,branchId:command.branchId || null,operation:"delete",changePayload:null};
    assertBranch(identity,existing.branch_id);
    const statements=[
      db.prepare(`DELETE FROM payments WHERE id=? AND organization_id=? AND ${commandGate()}`).bind(id,ORG_ID,command.commandId,ORG_ID,token),
      guardPreviousMutation(db,command,token),
      audit(db,command,identity,token,existing.branch_id,"Menghapus pembayaran",existing.order_id,now),
    ];
    return {statements,entityType:"payment",entityId:id,branchId:existing.branch_id,operation:"delete",changePayload:null,updatedAt:now};
  }
  const notaId=requiredString(p,"notaId",100);
  const branchId=command.branchId || requiredString(p,"branchId",100);
  assertBranch(identity,branchId);
  const order=await db.prepare("SELECT branch_id,total,paid FROM orders WHERE id=? AND organization_id=?").bind(notaId,ORG_ID).first<{branch_id:string;total:number;paid:number}>();
  if(!order || order.branch_id!==branchId) throw new CommandError(422,"Service pembayaran tidak ditemukan pada cabang ini");
  const existing=await db.prepare("SELECT id FROM payments WHERE id=? AND organization_id=?").bind(id,ORG_ID).first<{id:string}>();
  if(existing) throw new CommandError(409,"Pembayaran dengan ID ini sudah tercatat");
  const amount=integer(p,"amount",1);
  const recorded=await db.prepare("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE order_id=? AND organization_id=?").bind(notaId,ORG_ID).first<{amount:number}>();
  if((recorded?.amount ?? 0) + amount > order.paid) throw new CommandError(422,"Pembayaran melebihi penerimaan Service");
  const method=requiredString(p,"method",30);
  if(!["Tunai","Qris","Transfer"].includes(method)) throw new CommandError(422,"Metode pembayaran tidak valid");
  const atMs=integer(p,"atMs",1);
  const payload={id,notaId,branchId,amount,method,atMs,at:optionalString(p,"at",80),by:identity.name};
  const gate=commandGate();
  const statements=[
    db.prepare(`INSERT INTO payments(id,organization_id,order_id,branch_id,amount,method,received_at,received_by,payload_json,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${gate}`).bind(id,ORG_ID,notaId,branchId,amount,method,atMs,identity.email.toLowerCase(),JSON.stringify(payload),now,command.commandId,ORG_ID,token),
    guardPreviousMutation(db,command,token),
    audit(db,command,identity,token,branchId,"Mencatat pembayaran",notaId,now),
  ];
  return {statements,entityType:"payment",entityId:id,branchId,changePayload:payload,updatedAt:now};
}

async function planGeneric(db:D1Database, command:SyncCommand, identity:SyncIdentity, token:string, now:number):Promise<Plan> {
  const p=command.payload;
  const id=command.entityId || requiredString(p,"id",100);
  const deleting=command.type.endsWith(".delete");
  const kind=command.type.split(".")[0];
  const configs:Record<string,{table:string;entity:string;branch:boolean;idColumn?:string}>= {
    expense:{table:"expenses",entity:"expense",branch:true}, attendance:{table:"attendance",entity:"attendance",branch:true}, customer:{table:"customers",entity:"customer",branch:false},
    branch:{table:"branches",entity:"branch",branch:false}, staff:{table:"staff",entity:"staff",branch:false,idColumn:"email"}, service:{table:"services",entity:"service",branch:false}, product:{table:"products",entity:"product",branch:false}, inventory:{table:"inventory_items",entity:"inventory",branch:true}, assetType:{table:"asset_types",entity:"assetType",branch:false}, accessRole:{table:"access_roles",entity:"accessRole",branch:false}, accessPolicy:{table:"access_policies",entity:"accessPolicy",branch:false,idColumn:"email"}, whatsappTemplate:{table:"whatsapp_templates",entity:"whatsappTemplate",branch:false},
  };
  const config=configs[kind];
  if(!config) throw new CommandError(422,"Command tidak didukung");
  let branchId=command.branchId || optionalString(p,"branchId",100) || null;
  if(!config.branch) branchId=null;
  const existingBranch=config.branch ? await existingBranchForEntity(db,config.table,id) : null;
  const previousStaffBranches=kind==="staff" ? (await db.prepare("SELECT branch_id FROM staff_branches WHERE lower(staff_email)=lower(?) ORDER BY branch_id").bind(id).all<{branch_id:string}>()).results.map(row=>row.branch_id) : [];
  const existingAttendance=kind==="attendance" ? await db.prepare("SELECT staff_email,branch_id FROM attendance WHERE id=? AND organization_id=?").bind(id,ORG_ID).first<{staff_email:string;branch_id:string}>() : null;
  if(deleting && config.branch && !branchId) branchId=existingBranch;
  if(config.branch) assertBranch(identity,branchId || "");
  if(existingBranch) assertBranch(identity,existingBranch);
  if(command.type==="attendance.upsert" && !commandPermission(identity,command.type,branchId || undefined,optionalString(p,"staffEmail",254)).allowed) throw new CommandError(403,"Karyawan hanya dapat mengubah absensinya sendiri");
  if(existingAttendance) {
      assertBranch(identity,existingAttendance.branch_id);
      if(!attendanceRecordOwnedBy(identity,existingAttendance.staff_email)) throw new CommandError(403,"Karyawan hanya dapat mengubah absensinya sendiri");
  }
  const gate=commandGate(); const statements:D1PreparedStatement[]=[];
  if(deleting) {
    if(kind==="attendance" && identity.role!=="Owner") {
      if(!existingAttendance || !attendanceRecordOwnedBy(identity,existingAttendance.staff_email)) throw new CommandError(403,"Karyawan hanya dapat menghapus absensinya sendiri");
    }
    statements.push(db.prepare(`DELETE FROM ${config.table} WHERE ${config.idColumn ?? "id"}=? AND organization_id=? AND ${gate}`).bind(id,ORG_ID,command.commandId,ORG_ID,token));
    statements.push(guardPreviousMutation(db,command,token));
    if(kind==="staff") {
      const targets=previousStaffBranches.length ? previousStaffBranches : [null];
      targets.forEach(target=>statements.push(journal(db,command,identity,token,"staff",id,"delete",target,null,now)));
    }
    if(branchId) statements.push(audit(db,command,identity,token,branchId,command.type,null,now));
    return {statements,entityType:config.entity,entityId:id,branchId,operation:"delete",changePayload:kind==="attendance"?{staffEmail:existingAttendance?.staff_email ?? ""}:null,journaled:kind==="staff"};
  }
  if(kind==="expense") statements.push(db.prepare(`INSERT INTO expenses(id,organization_id,branch_id,category,amount,occurred_at,officer,note,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,category=excluded.category,amount=excluded.amount,occurred_at=excluded.occurred_at,officer=excluded.officer,note=excluded.note,updated_at=excluded.updated_at`).bind(id,ORG_ID,branchId,requiredString(p,"category",100),integer(p,"amount",1),typeof p.occurredAt === "number"?integer(p,"occurredAt",1):integer(p,"occurredAtMs",1),identity.email.toLowerCase(),optionalString(p,"note",500),now,command.commandId,ORG_ID,token));
  else if(kind==="attendance") statements.push(db.prepare(`INSERT INTO attendance(id,organization_id,branch_id,staff_email,staff_name,work_date,check_in_at,check_out_at,note,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,check_out_at=excluded.check_out_at,note=excluded.note,updated_at=excluded.updated_at`).bind(id,ORG_ID,branchId,requiredString(p,"staffEmail",254).toLowerCase(),requiredString(p,"staffName",160),requiredString(p,"workDate",20),typeof p.checkInAt === "number"?integer(p,"checkInAt",1):integer(p,"checkInAtMs",1),p.checkOutAt ?? p.checkOutAtMs ?? null,optionalString(p,"note",500),now,command.commandId,ORG_ID,token));
  else if(kind==="customer") statements.push(db.prepare(`INSERT INTO customers(id,organization_id,name,phone,address,updated_at) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,address=excluded.address,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"name",200),optionalString(p,"phone",40),optionalString(p,"address",500),now,command.commandId,ORG_ID,token));
  else if(kind==="branch") statements.push(db.prepare(`INSERT INTO branches(id,organization_id,code,name,address,maps_query,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,address=excluded.address,maps_query=excluded.maps_query,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"code",40),requiredString(p,"name",200),firstString(p,["address","location"],false,500),optionalString(p,"mapsQuery",500),now,command.commandId,ORG_ID,token));
  else if(kind==="staff") {
    const email=requiredString(p,"email",254).toLowerCase();
    statements.push(db.prepare(`INSERT INTO staff(email,organization_id,name,role,approved,active,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,approved=excluded.approved,active=excluded.active,updated_at=excluded.updated_at`).bind(email,ORG_ID,requiredString(p,"name",160),requiredString(p,"role",30),flag(p,"approved"),p.active===false?0:1,now,command.commandId,ORG_ID,token));
    statements.push(db.prepare(`DELETE FROM staff_branches WHERE staff_email=? AND ${gate}`).bind(email,command.commandId,ORG_ID,token));
    const ids=Array.isArray(p.branchIds)?p.branchIds.filter((x):x is string=>typeof x==="string"&&x.length>0):[];
    ids.forEach(branch=>statements.push(db.prepare(`INSERT OR IGNORE INTO staff_branches(staff_email,branch_id) SELECT ?,? WHERE ${gate}`).bind(email,branch,command.commandId,ORG_ID,token)));
  }
  else if(kind==="service") statements.push(db.prepare(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,product_id,active,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,default_price=excluded.default_price,commission_per_unit=excluded.commission_per_unit,retail=excluded.retail,drop_out=excluded.drop_out,self_service=excluded.self_service,product_id=excluded.product_id,active=excluded.active,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"name",200),requiredString(p,"unit",40),typeof p.defaultPrice === "number"?integer(p,"defaultPrice"):integer(p,"price"),integer(p,"commissionPerUnit"),flag(p,"retail"),flag(p,"dropOut"),flag(p,"selfService"),optionalString(p,"productKey",100) || null,p.active===false?0:1,now,command.commandId,ORG_ID,token));
  else if(kind==="product") statements.push(db.prepare(`INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,minimum_stock=excluded.minimum_stock,kind=excluded.kind,unit=excluded.unit,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"name",200),typeof p.minimumStock === "number"?integer(p,"minimumStock"):integer(p,"min"),optionalString(p,"kind",80) || "BahanHabisPakai",optionalString(p,"unit",40) || "pcs",now,command.commandId,ORG_ID,token));
  else if(kind==="accessPolicy") statements.push(db.prepare(`INSERT INTO access_policies(email,organization_id,payload_json,updated_at) SELECT ?,?,?,? WHERE ${gate} ON CONFLICT(email,organization_id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(requiredString(p,"email",254).toLowerCase(),ORG_ID,JSON.stringify({...p,email:requiredString(p,"email",254).toLowerCase()}),now,command.commandId,ORG_ID,token));
  else if(kind==="whatsappTemplate") statements.push(db.prepare(`INSERT INTO whatsapp_templates(id,organization_id,payload_json,updated_at) SELECT ?,?,?,? WHERE ${gate} ON CONFLICT(id,organization_id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(id,ORG_ID,JSON.stringify({...p,id}),now,command.commandId,ORG_ID,token));
  else if(kind==="assetType") statements.push(db.prepare(`INSERT INTO asset_types(id,organization_id,code,name,active,updated_at) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"code",8).toUpperCase(),requiredString(p,"name",120),p.active===false?0:1,now,command.commandId,ORG_ID,token));
  else if(kind==="accessRole") statements.push(db.prepare(`INSERT INTO access_roles(id,organization_id,name,built_in,payload_json,updated_at) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"name",120),p.builtIn===true?1:0,JSON.stringify({...p,id}),now,command.commandId,ORG_ID,token));
  else statements.push(db.prepare(`INSERT INTO inventory_items(id,organization_id,branch_id,payload_json,updated_at) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(id,ORG_ID,branchId,JSON.stringify({...p,id,branchId,updatedAt:now}),now,command.commandId,ORG_ID,token));
  if(branchId) statements.push(audit(db,command,identity,token,branchId,command.type,null,now));
  const { passwordHash: _passwordHash, ...withoutLocalPassword } = p;
  const safePayload=kind==="staff" ? withoutLocalPassword : p;
  const actorPayload=kind==="expense" ? {...safePayload,by:identity.name} : safePayload;
  const changePayload={...actorPayload,id,...(config.branch?{branchId}:{}),updatedAt:now};
  let journaled=false;
  if(kind==="staff") {
    const nextStaffBranches=Array.isArray(p.branchIds)?[...new Set(p.branchIds.filter((x):x is string=>typeof x==="string"&&x.length>0))]:[];
    const scopes=staffJournalScopes(previousStaffBranches,nextStaffBranches);
    scopes.deletes.forEach(old=>statements.push(journal(db,command,identity,token,"staff",id,"delete",old,null,now)));
    scopes.upserts.forEach(target=>statements.push(journal(db,command,identity,token,"staff",id,"upsert",target,changePayload,now)));
    journaled=true;
  }
  return {statements,entityType:command.wireEntityType ?? config.entity,entityId:id,branchId,changePayload,journaled};
}

async function executeCommand(env:CommandEnv, command:SyncCommand, identity:SyncIdentity):Promise<JsonRecord> {
  assertRole(identity,command);
  await assertCustomAccess(env.DB,identity,command);
  const requestHash=await sha256(stable({type:command.type,entityId:command.entityId,branchId:command.branchId,expectedUpdatedAt:command.expectedUpdatedAt,payload:command.payload}));
  const previous=await env.DB.prepare("SELECT request_hash,result_json FROM processed_commands WHERE command_id=? AND organization_id=?").bind(command.commandId,ORG_ID).first<{request_hash:string|null;result_json:string|null}>();
  if(previous) {
    if(previous.request_hash && previous.request_hash!==requestHash) throw new CommandError(409,"commandId pernah dipakai untuk isi berbeda");
    return previous.result_json ? {...JSON.parse(previous.result_json) as JsonRecord,replayed:true} : {commandId:command.commandId,accepted:true,replayed:true};
  }
  const token=crypto.randomUUID(); const now=Date.now();
  let plan:Plan;
  if(command.type.startsWith("order.")) plan=await planOrder(env.DB,command,identity,token,now);
  else if(command.type==="stock.batch") plan=await planStock(env.DB,command,identity,token,now);
  else if(command.type.startsWith("branchStock.")) plan=await planDerivedStock(env.DB,command,identity,token);
  else if(command.type.startsWith("stockMove.")) plan=await planStockMove(env.DB,command,identity,token,now);
  else if(command.type.startsWith("audit.") || command.type.startsWith("cashClose.")) plan=await planRawOperational(env.DB,command,identity,token,now);
  else if(command.type.startsWith("payment.")) plan=await planPayment(env.DB,command,identity,token,now);
  else plan=await planGeneric(env.DB,command,identity,token,now);
  const initial=env.DB.prepare("INSERT OR IGNORE INTO processed_commands(command_id,organization_id,processed_at,command_type,actor_email,request_hash,execution_token,result_json) VALUES(?,?,?,?,?,?,?,NULL)").bind(command.commandId,ORG_ID,now,command.type,identity.email.toLowerCase(),requestHash,token);
  const operation=plan.operation ?? "upsert";
  const updatedAt=plan.updatedAt ?? now;
  const organization=env.DB.prepare("INSERT OR IGNORE INTO organizations(id,name,owner_email,created_at,updated_at) VALUES(?,?,?,?,?)").bind(ORG_ID,"Cuciin","tiftazani.khara@gmail.com",now,now);
  const all=[organization,initial,...plan.statements];
  if(!plan.journaled && !["stock-batch","derived-noop"].includes(plan.entityType)) all.push(journal(env.DB,command,identity,token,plan.entityType,plan.entityId,operation,plan.branchId,plan.changePayload,updatedAt));
  const result={commandId:command.commandId,accepted:true,replayed:false,entityType:plan.entityType,entityId:plan.entityId,updatedAt};
  all.push(env.DB.prepare(`UPDATE processed_commands SET result_json=? WHERE command_id=? AND organization_id=? AND execution_token=?`).bind(JSON.stringify(result),command.commandId,ORG_ID,token));
  all.push(env.DB.prepare("DELETE FROM sync_command_guards WHERE execution_token=?").bind(token));
  try { await env.DB.batch(all); }
  catch(error) {
    if(String(error).includes("stock_below_zero")) throw new CommandError(409,"Stok tidak mencukupi");
    if(String(error).includes("CHECK constraint failed")) throw new CommandError(409,"Data sudah berubah di perangkat lain");
    if(String(error).includes("UNIQUE constraint")) throw new CommandError(409,"Data bertabrakan dengan perubahan lain");
    throw error;
  }
  const saved=await env.DB.prepare("SELECT request_hash,result_json FROM processed_commands WHERE command_id=? AND organization_id=?").bind(command.commandId,ORG_ID).first<{request_hash:string|null;result_json:string|null}>();
  if(!saved) throw new CommandError(500,"Command gagal dicatat");
  if(saved.request_hash && saved.request_hash!==requestHash) throw new CommandError(409,"commandId pernah dipakai untuk isi berbeda");
  return saved.result_json ? JSON.parse(saved.result_json) as JsonRecord : result;
}

export async function pushCommands(request:Request, env:CommandEnv, identity:SyncIdentity):Promise<Response> {
  const length=Number(request.headers.get("content-length") ?? 0);
  if(length>MAX_COMMAND_BODY_BYTES) return response({error:"Payload command terlalu besar"},413);
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>MAX_COMMAND_BODY_BYTES) return response({error:"Payload command terlalu besar"},413);
  let raw:unknown; try { raw=JSON.parse(text); } catch { return response({error:"JSON tidak valid"},400); }
  if(!isObject(raw) || !Array.isArray(raw.commands) || raw.commands.length<1 || raw.commands.length>MAX_COMMANDS) return response({error:`commands harus berisi 1–${MAX_COMMANDS} item`},422);
  const results:JsonRecord[]=[];
  let commands:SyncCommand[]=[];
  // Satu command yang tidak valid tidak boleh menahan seluruh antrean perangkat.
  // Batch yang gagal di-parse seluruhnya dulu membuat klien menerima 422 tanpa
  // results, sehingga perangkat tidak tahu command mana yang harus dibuang dan
  // antreannya macet selamanya. Sekarang command yang sah tetap dijalankan.
  const parsed:Array<SyncCommand|null>=[];
  for(const item of raw.commands) {
    if(!isObject(item)) { results.push({commandId:"",accepted:false,status:"rejected",code:422,error:"Command tidak valid"}); parsed.push(null); continue; }
    try { parsed.push(parseCommand(item)); }
    catch(error) {
      const commandId=typeof item.commandId === "string" ? item.commandId.trim() : "";
      results.push(error instanceof CommandError
        ? {commandId,accepted:false,status:"rejected",code:error.status,error:error.message,detail:error.detail}
        : {commandId,accepted:false,status:"rejected",code:422,error:"Command tidak valid"});
      parsed.push(null);
    }
  }
  commands=parsed.filter((command):command is SyncCommand => command !== null);
  const seenIds=new Set<string>();
  for(const command of commands) {
    if(seenIds.has(command.commandId)) return response({error:"commandId dalam satu request tidak boleh duplikat"},422);
    seenIds.add(command.commandId);
  }
  let priorFailure=false;
  for(const command of commands) {
    if(priorFailure) {
      results.push({commandId:command.commandId,accepted:false,status:"retryable",code:503,error:"Menunggu command sebelumnya berhasil"});
      continue;
    }
    try { results.push(await executeCommand(env,command,identity)); }
    catch(error) {
      if(!(error instanceof CommandError) || error.status >= 500) console.error("command_retryable",command.commandId,error);
      results.push(commandFailureResult(command.commandId,error));
      // Hanya gangguan sementara yang menahan command berikutnya. Command yang
      // ditolak permanen (4xx) sudah dilaporkan ke perangkat dan akan dibuang dari
      // antrean; menghentikan rantai di sini membuat command sesudahnya berstatus
      // retryable selamanya sehingga seluruh antrean perangkat macet.
      priorFailure = !(error instanceof CommandError) || error.status >= 500;
    }
  }
  const acknowledgedCommandIds=results.filter(item=>item.accepted===true).map(item=>String(item.commandId));
  const latest=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
  const revision=latest?.revision ?? 0;
  results.forEach(item=>{ if(item.accepted===true) item.status=item.replayed===true?"duplicate":"applied"; });
  return response({revision,acknowledgedCommandIds,results});
}

export async function pullChanges(request:Request, env:CommandEnv, identity:SyncIdentity):Promise<Response> {
  const url=new URL(request.url);
  const after=Number(url.searchParams.get("after") ?? 0);
  const requestedLimit=Number(url.searchParams.get("limit") ?? 200);
  if(!Number.isSafeInteger(after) || after<0 || !Number.isSafeInteger(requestedLimit) || requestedLimit<1) return response({error:"Parameter after/limit tidak valid"},422);
  const limit=Math.min(requestedLimit,MAX_CHANGE_LIMIT);
  let query="SELECT sequence,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id FROM sync_changes WHERE organization_id=? AND sequence>?";
  const binds:unknown[]=[ORG_ID,after];
  if(!identity.bootstrap && identity.role!=="Owner") {
    if(identity.branchIds.length) {
      const slots=identity.branchIds.map(()=>"?").join(",");
      query+=` AND ((branch_id IN (${slots}) AND (entity_type!='attendance' OR lower(json_extract(payload_json,'$.staffEmail'))=lower(?))) OR (branch_id IS NULL AND entity_type NOT IN ('staff','branch','attendance')) OR (entity_type='branch' AND entity_id IN (${slots})))`;
      binds.push(...identity.branchIds,identity.email,...identity.branchIds);
    } else query+=" AND branch_id IS NULL AND entity_type NOT IN ('staff','branch','attendance')";
  }
  query+=" ORDER BY sequence ASC LIMIT ?"; binds.push(limit+1);
  const rows=(await env.DB.prepare(query).bind(...binds).all<{sequence:number;entity_type:string;entity_id:string;operation:string;payload_json:string|null;updated_at:number;branch_id:string|null;actor_email:string|null;command_id:string|null}>()).results;
  const hasMore=rows.length>limit; const page=rows.slice(0,limit);
  const latest=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
  const nextRevision=page.at(-1)?.sequence ?? after;
  return response({revision:nextRevision,changes:page.map(row=>({revision:row.sequence,entityType:row.entity_type,entityId:row.entity_id,operation:row.operation,payload:row.payload_json?JSON.parse(row.payload_json):null,updatedAt:row.updated_at,branchId:row.branch_id,actorEmail:row.actor_email,commandId:row.command_id})),nextRevision,latestRevision:latest?.revision ?? 0,hasMore,scopeKey:syncScopeKey(identity)});
}
