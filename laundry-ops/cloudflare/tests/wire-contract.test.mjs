/**
 * Kontrak wire antara aplikasi Android dan Worker.
 *
 * Perangkat membentuk command dari SyncProjection: setiap tipe entitas bisa dikirim
 * sebagai upsert (baris muncul) atau delete (baris hilang dari snapshot). Kalau satu
 * kombinasi saja tidak ada di KNOWN_COMMANDS Worker, seluruh batch ditolak 422 dan
 * antrean perangkat macet. Itu yang pernah terjadi pada payment.delete.
 *
 * Daftar tipe di bawah harus mengikuti SyncProjection.specs di
 * android/app/src/main/java/com/cuciin/laundryops/data/SyncProtocol.kt.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseCommand } from "../src/command-sync.ts";

/** Tipe entitas yang dapat dikirim perangkat, sama dengan SyncProjection.specs. */
const TIPE_PERANGKAT = [
  "branch",
  "staff",
  "customer",
  "service",
  "product",
  "branchStock",
  "inventory",
  "assetType",
  "expense",
  "nota",
  "stockMove",
  "audit",
  "cashClose",
  "payment",
  "attendance",
  "accessPolicy",
  "accessRole",
  "whatsappTemplate",
];

function commandUntuk(entityType, operation) {
  return {
    commandId: `kontrak-${entityType}-${operation}`.toLowerCase().replace(/[^a-z0-9._:-]/g, "-").slice(0, 90),
    entityType,
    entityId: `id-${entityType}`,
    operation,
    branchId: "melati",
    occurredAt: 1,
    payload: operation === "delete" ? null : { id: `id-${entityType}`, branchId: "melati" },
  };
}

test("setiap tipe entitas perangkat dikenal Worker untuk upsert dan delete", () => {
  const tidakDikenal = [];
  for (const entityType of TIPE_PERANGKAT) {
    for (const operation of ["upsert", "delete"]) {
      try {
        parseCommand(commandUntuk(entityType, operation));
      } catch (error) {
        tidakDikenal.push(`${entityType}.${operation}: ${error.message}`);
      }
    }
  }
  assert.deepEqual(tidakDikenal, [], `Command perangkat yang tidak dikenal Worker:\n${tidakDikenal.join("\n")}`);
});

test("command dengan tipe yang tidak dikenal tetap ditolak, bukan diterima diam-diam", () => {
  assert.throws(
    () => parseCommand({ ...commandUntuk("payment", "upsert"), type: "payment.hitungUlang" }),
    (error) => error.status === 422 && /tidak didukung/.test(error.message),
  );
  assert.throws(
    () => parseCommand({ ...commandUntuk("payment", "upsert"), entityType: "entahApa" }),
    (error) => error.status === 422,
  );
});

test("delete tanpa payload tetap diterima karena perangkat mengirim payload null", () => {
  const parsed = parseCommand(commandUntuk("payment", "delete"));
  assert.equal(parsed.type, "payment.delete");
  assert.equal(parsed.entityId, "id-payment");
});
