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
const OWNER_ONLY = new Set(["branch.upsert", "staff.upsert", "service.upsert", "product.upsert"]);
const KNOWN_COMMANDS = new Set([
  "order.create", "order.update", "order.put", "order.delete", "order.status", "order.payment", "order.handover",
  "stock.batch", "expense.upsert", "expense.delete", "attendance.upsert", "attendance.delete", "customer.upsert",
  "branch.upsert", "branch.delete", "staff.upsert", "staff.delete", "service.upsert", "service.delete", "product.upsert", "product.delete", "customer.delete", "inventory.upsert", "inventory.delete",
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
  const aliases:Record<string,string>={branch:"branch",staff:"staff",customer:"customer",service:"service",product:"product",inventory:"inventory",expense:"expense",attendance:"attendance",nota:"order",branchStock:"branchStock",stockMove:"stockMove",audit:"audit",cashClose:"cashClose"};
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
  if ((OWNER_ONLY.has(type) || ["branch.delete","staff.delete","service.delete","product.delete","stockMove.delete","audit.delete","cashClose.delete"].includes(type)) && identity.role !== "Owner") return { allowed:false,reason:"owner" };
  if (type === "order.delete" && identity.role !== "Owner") return { allowed:false,reason:"owner" };
  if (["expense.upsert", "expense.delete", "cashClose.upsert", "cashClose.delete"].includes(type) && identity.role === "Supervisor") return { allowed:false,reason:"role" };
  if (["order.create", "order.update", "order.put", "order.payment", "order.handover"].includes(type) && identity.role === "Supervisor") return { allowed:false,reason:"role" };
  if (branchId && identity.role !== "Owner" && !identity.branchIds.includes(branchId)) return { allowed:false,reason:"branch" };
  if (type === "attendance.upsert" && identity.role !== "Owner" && staffEmail?.toLowerCase() !== identity.email.toLowerCase()) return { allowed:false,reason:"self" };
  return { allowed:true };
}

function assertBranch(identity: SyncIdentity, branchId: string): void {
  if (!branchId) throw new CommandError(422, "branchId wajib diisi");
  if (!identity.bootstrap && identity.role !== "Owner" && !identity.branchIds.includes(branchId)) throw new CommandError(403, "Cabang tidak diizinkan");
}
function assertRole(identity: SyncIdentity, command: SyncCommand): void {
  if(identity.role==="Supervisor" && command.type==="order.put" && command.wireEntityType==="nota") return;
  const permission=commandPermission(identity,command.type,command.branchId);
  if (!permission.allowed) throw new CommandError(403, permission.reason === "owner" ? "Command khusus Owner" : "Role tidak diizinkan");
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

type Plan = { statements: D1PreparedStatement[]; entityType: string; entityId: string; branchId: string | null; operation?: "upsert"|"delete"; changePayload?: unknown };

type RetailAdjustment={productId:string;productName:string;delta:number};
async function retailAdjustments(db:D1Database, orderId:string, lines:Array<{serviceId:string;serviceName:string;quantity:number}>):Promise<RetailAdjustment[]> {
  const old=(await db.prepare(`SELECT p.id AS product_id,p.name AS product_name,l.quantity FROM order_lines l JOIN services s ON s.id=l.service_id AND s.organization_id=? JOIN products p ON p.organization_id=? AND (p.id=s.id OR p.name=s.name) WHERE l.order_id=? AND s.retail=1`).bind(ORG_ID,ORG_ID,orderId).all<{product_id:string;product_name:string;quantity:number}>()).results;
  const serviceIds=[...new Set(lines.map(line=>line.serviceId))];
  const current=serviceIds.length ? (await db.prepare(`SELECT s.id,p.id AS product_id,p.name AS product_name,s.retail FROM services s LEFT JOIN products p ON p.organization_id=s.organization_id AND (p.id=s.id OR p.name=s.name) WHERE s.organization_id=? AND s.id IN (${serviceIds.map(()=>"?").join(",")})`).bind(ORG_ID,...serviceIds).all<{id:string;product_id:string|null;product_name:string|null;retail:number}>()).results : [];
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
  const branchId = command.branchId || optionalString(p, "branchId", 100) || existing?.branch_id || "";
  assertBranch(identity, branchId);
  if (existing) assertBranch(identity, existing.branch_id);
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
    return {statements,entityType:"nota",entityId:id,branchId,changePayload:canonical};
  }

  if (command.type === "order.delete") {
    if (!existing) throw new CommandError(404, "Service tidak ditemukan");
    const adjustments=await retailAdjustments(db,id,[]);
    statements.push(db.prepare(`DELETE FROM orders WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(id, ORG_ID, existing.updated_at, command.commandId, ORG_ID, token));
    statements.push(guardPreviousMutation(db,command,token));
    appendRetailStock(db,statements,command,identity,token,branchId,adjustments,now);
    statements.push(audit(db, command, identity, token, branchId, "Menghapus Service", id, now));
    return { statements, entityType: command.wireEntityType ?? "order", entityId: id, branchId, operation: "delete", changePayload: null };
  }

  if (["order.status", "order.payment", "order.handover"].includes(command.type)) {
    if (!existing) throw new CommandError(404, "Service tidak ditemukan");
    if (command.type === "order.status") {
      const status = requiredString(p, "workStatus", 80);
      statements.push(db.prepare(`UPDATE orders SET work_status=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(status, p.completedAt ?? null, now, id, ORG_ID, existing.updated_at, command.commandId, ORG_ID, token));
    } else if (command.type === "order.payment") {
      const paid = integer(p, "paid");
      if (paid > existing.total) throw new CommandError(422,"Pembayaran melebihi grand total");
      const status = requiredString(p, "paymentStatus", 50);
      const method = requiredString(p, "paymentMethod", 50);
      statements.push(db.prepare(`UPDATE orders SET paid=?,payment_status=?,payment_method=?,updated_at=? WHERE id=? AND organization_id=? AND updated_at=? AND ?<=total AND ${gate}`).bind(paid,status,method,now,id,ORG_ID,existing.updated_at,paid,command.commandId,ORG_ID,token));
    } else {
      const pickedUpAt = requiredString(p, "pickedUpAt", 80);
      statements.push(db.prepare(`UPDATE orders SET picked_up_at=?,updated_at=? WHERE id=? AND organization_id=? AND updated_at=? AND ${gate}`).bind(pickedUpAt,now,id,ORG_ID,existing.updated_at,command.commandId,ORG_ID,token));
    }
    statements.push(guardPreviousMutation(db,command,token));
    statements.push(audit(db, command, identity, token, branchId, command.type, id, now));
    return { statements, entityType: "order", entityId: id, branchId, changePayload: { ...p, id, branchId, updatedAt: now } };
  }

  const linesRaw = p.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length < 1 || linesRaw.length > 80) throw new CommandError(422, "Service harus memiliki 1–80 rincian");
  const lines = linesRaw.map((raw, index) => {
    if (!isObject(raw)) throw new CommandError(422, `Rincian ${index + 1} tidak valid`);
    const handlerEmail = identity.role === "Owner" || identity.bootstrap ? firstString(raw,["handlerEmail","handledByEmail"],false,254).toLowerCase() : identity.email.toLowerCase();
    const handlerName = identity.role === "Owner" || identity.bootstrap ? firstString(raw,["handlerName","handledByName"],false,160) : identity.name;
    return {
      serviceId: requiredString(raw,"serviceId",100), serviceName: firstString(raw,["serviceName","name"],true,200), quantity: typeof raw.quantity === "number" ? finiteNumber(raw,"quantity",0.001) : finiteNumber(raw,"qty",0.001),
      unit: requiredString(raw,"unit",40), unitPrice: integer(raw,"unitPrice"), handlerEmail, handlerName,
      commissionPerUnit: integer(raw,"commissionPerUnit"),
    };
  });
  const total = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);
  const stockAdjustments=await retailAdjustments(db,id,lines);
  const paid = integer(p,"paid");
  if (paid > total) throw new CommandError(422, "Pembayaran melebihi grand total");
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
  return { statements, entityType:command.wireEntityType ?? "order", entityId:id, branchId, changePayload:canonical };
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
    statements.push(journal(db,command,identity,token,"stock",`${branchId}:${item.productId}`,"upsert",branchId,payload,now));
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
    if(!order) throw new CommandError(409,"Service asal mutasi stok belum tersimpan");
  } else if(isSet) statements.push(db.prepare(`INSERT INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,?,? WHERE ${commandGate()} ON CONFLICT(branch_id,product_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at`).bind(branchId,product.id,target,now,command.commandId,ORG_ID,token));
  else {
    statements.push(db.prepare(`INSERT OR IGNORE INTO branch_stocks(branch_id,product_id,quantity,updated_at) SELECT ?,?,0,? WHERE ${commandGate()}`).bind(branchId,product.id,now,command.commandId,ORG_ID,token));
    statements.push(db.prepare(`UPDATE branch_stocks SET quantity=quantity+?,updated_at=? WHERE branch_id=? AND product_id=? AND ${commandGate()}`).bind(target,now,branchId,product.id,command.commandId,ORG_ID,token));
  }
  const canonical={...p,branchId,product:product.id,by:identity.name,atMs:typeof p.atMs === "number" ? p.atMs : now};
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
    const actor=identity.email.toLowerCase();
    statements.push(db.prepare(`INSERT INTO audit_logs(id,organization_id,branch_id,actor,action,order_id,occurred_at) SELECT ?,?,?,?,?,?,? WHERE ${commandGate()} ON CONFLICT(id) DO NOTHING`).bind(id,ORG_ID,branchId,actor,requiredString(p,"action",500),typeof p.notaId === "string" ? p.notaId : null,typeof p.atMs === "number" ? p.atMs : now,command.commandId,ORG_ID,token));
    return {statements,entityType:"audit",entityId:id,branchId,changePayload:{...p,user:actor,branchId}};
  }
  if(command.wireEntityType==="cashClose") {
    if(deleting) statements.push(db.prepare(`DELETE FROM cash_closes WHERE id=? AND organization_id=? AND ${commandGate()}`).bind(id,ORG_ID,command.commandId,ORG_ID,token));
    else statements.push(db.prepare(`INSERT INTO cash_closes(id,organization_id,branch_id,payload_json,occurred_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${commandGate()} ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,payload_json=excluded.payload_json,occurred_at=excluded.occurred_at,updated_at=excluded.updated_at`).bind(id,ORG_ID,branchId,JSON.stringify({...p,id,branchId,by:identity.name}),typeof p.atMs === "number" ? p.atMs : now,now,command.commandId,ORG_ID,token));
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

async function planGeneric(db:D1Database, command:SyncCommand, identity:SyncIdentity, token:string, now:number):Promise<Plan> {
  const p=command.payload;
  const id=command.entityId || requiredString(p,"id",100);
  const deleting=command.type.endsWith(".delete");
  const kind=command.type.split(".")[0];
  const configs:Record<string,{table:string;entity:string;branch:boolean;idColumn?:string}>= {
    expense:{table:"expenses",entity:"expense",branch:true}, attendance:{table:"attendance",entity:"attendance",branch:true}, customer:{table:"customers",entity:"customer",branch:false},
    branch:{table:"branches",entity:"branch",branch:false}, staff:{table:"staff",entity:"staff",branch:false,idColumn:"email"}, service:{table:"services",entity:"service",branch:false}, product:{table:"products",entity:"product",branch:false}, inventory:{table:"inventory_items",entity:"inventory",branch:true},
  };
  const config=configs[kind];
  if(!config) throw new CommandError(422,"Command tidak didukung");
  let branchId=command.branchId || optionalString(p,"branchId",100) || null;
  if(!config.branch) branchId=null;
  const existingBranch=config.branch ? await existingBranchForEntity(db,config.table,id) : null;
  if(deleting && config.branch && !branchId) branchId=existingBranch;
  if(config.branch) assertBranch(identity,branchId || "");
  if(existingBranch) assertBranch(identity,existingBranch);
  if(command.type==="attendance.upsert" && !commandPermission(identity,command.type,branchId || undefined,optionalString(p,"staffEmail",254)).allowed) throw new CommandError(403,"Karyawan hanya dapat mengubah absensinya sendiri");
  const gate=commandGate(); const statements:D1PreparedStatement[]=[];
  if(deleting) {
    if(kind==="attendance" && identity.role!=="Owner") {
      const row=await db.prepare("SELECT staff_email FROM attendance WHERE id=? AND organization_id=?").bind(id,ORG_ID).first<{staff_email:string}>();
      if(!row || row.staff_email.toLowerCase()!==identity.email.toLowerCase()) throw new CommandError(403,"Karyawan hanya dapat menghapus absensinya sendiri");
    }
    statements.push(db.prepare(`DELETE FROM ${config.table} WHERE ${config.idColumn ?? "id"}=? AND organization_id=? AND ${gate}`).bind(id,ORG_ID,command.commandId,ORG_ID,token));
    statements.push(guardPreviousMutation(db,command,token));
    if(branchId) statements.push(audit(db,command,identity,token,branchId,command.type,null,now));
    return {statements,entityType:config.entity,entityId:id,branchId,operation:"delete",changePayload:null};
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
  else if(kind==="service") statements.push(db.prepare(`INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,active,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,default_price=excluded.default_price,commission_per_unit=excluded.commission_per_unit,retail=excluded.retail,drop_out=excluded.drop_out,self_service=excluded.self_service,active=excluded.active,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"name",200),requiredString(p,"unit",40),typeof p.defaultPrice === "number"?integer(p,"defaultPrice"):integer(p,"price"),integer(p,"commissionPerUnit"),flag(p,"retail"),flag(p,"dropOut"),flag(p,"selfService"),p.active===false?0:1,now,command.commandId,ORG_ID,token));
  else if(kind==="product") statements.push(db.prepare(`INSERT INTO products(id,organization_id,name,minimum_stock,updated_at) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,minimum_stock=excluded.minimum_stock,updated_at=excluded.updated_at`).bind(id,ORG_ID,requiredString(p,"name",200),typeof p.minimumStock === "number"?integer(p,"minimumStock"):integer(p,"min"),now,command.commandId,ORG_ID,token));
  else statements.push(db.prepare(`INSERT INTO inventory_items(id,organization_id,branch_id,payload_json,updated_at) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(id,ORG_ID,branchId,JSON.stringify({...p,id,branchId,updatedAt:now}),now,command.commandId,ORG_ID,token));
  if(branchId) statements.push(audit(db,command,identity,token,branchId,command.type,null,now));
  const { passwordHash: _passwordHash, ...withoutLocalPassword } = p;
  const safePayload=kind==="staff" ? withoutLocalPassword : p;
  const actorPayload=kind==="expense" ? {...safePayload,by:identity.name} : safePayload;
  return {statements,entityType:command.wireEntityType ?? config.entity,entityId:id,branchId,changePayload:{...actorPayload,id,...(config.branch?{branchId}:{}),updatedAt:now}};
}

async function executeCommand(env:CommandEnv, command:SyncCommand, identity:SyncIdentity):Promise<JsonRecord> {
  assertRole(identity,command);
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
  else plan=await planGeneric(env.DB,command,identity,token,now);
  const initial=env.DB.prepare("INSERT OR IGNORE INTO processed_commands(command_id,organization_id,processed_at,command_type,actor_email,request_hash,execution_token,result_json) VALUES(?,?,?,?,?,?,?,NULL)").bind(command.commandId,ORG_ID,now,command.type,identity.email.toLowerCase(),requestHash,token);
  const operation=plan.operation ?? "upsert";
  const organization=env.DB.prepare("INSERT OR IGNORE INTO organizations(id,name,owner_email,created_at,updated_at) VALUES(?,?,?,?,?)").bind(ORG_ID,"Cuciin","tiftazani.khara@gmail.com",now,now);
  const all=[organization,initial,...plan.statements];
  if(!["stock-batch","derived-noop"].includes(plan.entityType)) all.push(journal(env.DB,command,identity,token,plan.entityType,plan.entityId,operation,plan.branchId,plan.changePayload,now));
  const result={commandId:command.commandId,accepted:true,replayed:false,entityType:plan.entityType,entityId:plan.entityId,updatedAt:now};
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
  let commands:SyncCommand[];
  try { commands=raw.commands.map(parseCommand); } catch(error) { return error instanceof CommandError ? response({error:error.message,detail:error.detail},error.status) : response({error:"Command tidak valid"},422); }
  if(new Set(commands.map(c=>c.commandId)).size!==commands.length) return response({error:"commandId dalam satu request tidak boleh duplikat"},422);
  const results:JsonRecord[]=[];
  for(const command of commands) {
    try { results.push(await executeCommand(env,command,identity)); }
    catch(error) {
      if(error instanceof CommandError) results.push({commandId:command.commandId,accepted:false,status:"rejected",code:error.status,error:error.message,detail:error.detail});
      else { console.error("command_failed",command.commandId,error); results.push({commandId:command.commandId,accepted:false,status:"error",code:500,error:"Command gagal diproses"}); }
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
    if(identity.branchIds.length) { query+=` AND (branch_id IS NULL OR branch_id IN (${identity.branchIds.map(()=>"?").join(",")}))`; binds.push(...identity.branchIds); }
    else query+=" AND branch_id IS NULL";
  }
  query+=" ORDER BY sequence ASC LIMIT ?"; binds.push(limit+1);
  const rows=(await env.DB.prepare(query).bind(...binds).all<{sequence:number;entity_type:string;entity_id:string;operation:string;payload_json:string|null;updated_at:number;branch_id:string|null;actor_email:string|null;command_id:string|null}>()).results;
  const hasMore=rows.length>limit; const page=rows.slice(0,limit);
  const latest=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
  const nextRevision=page.at(-1)?.sequence ?? after;
  return response({revision:nextRevision,changes:page.map(row=>({revision:row.sequence,entityType:row.entity_type,entityId:row.entity_id,operation:row.operation,payload:row.payload_json?JSON.parse(row.payload_json):null,updatedAt:row.updated_at,branchId:row.branch_id,actorEmail:row.actor_email,commandId:row.command_id})),nextRevision,latestRevision:latest?.revision ?? 0,hasMore});
}
