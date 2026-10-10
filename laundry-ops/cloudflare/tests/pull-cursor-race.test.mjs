import assert from "node:assert/strict";
import test from "node:test";
import { pullChanges } from "../src/command-sync.ts";
import { fakeD1, seedBaseline } from "./support/d1-harness.mjs";

const owner = { email: "owner@example.test", role: "Owner", branchIds: [], bootstrap: false };

function append(env, id, branch = "melati") {
  env.db.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id) VALUES('cuciin','customer',?,'upsert',?,1,?)")
    .run(id, JSON.stringify({ id, name: "Data contoh", phone: "", location: "" }), branch);
}

// A write arriving after the rows were read must remain visible on the next pull.
test("pull cursor cannot skip a concurrent write after page read", async () => {
  const env = fakeD1();
  seedBaseline(env);
  append(env, "before");
  const prepare = env.prepare.bind(env);
  let injected = false;
  env.prepare = sql => {
    const statement = prepare(sql);
    if (sql.startsWith("SELECT sequence,entity_type")) {
      const all = statement.all;
      statement.all = async () => {
        const result = await all();
        if (!injected) { injected = true; append(env, "concurrent"); }
        return result;
      };
    }
    return statement;
  };
  const first = await (await pullChanges(new Request("https://synthetic.test/v1/sync/changes?after=0"), env, owner)).json();
  assert.deepEqual(first.changes.map(c => c.entityId), ["before"]);
  const clientCursor = first.hasMore ? first.nextRevision : Math.max(first.nextRevision, first.latestRevision);
  const second = await (await pullChanges(new Request(`https://synthetic.test/v1/sync/changes?after=${clientCursor}`), env, owner)).json();
  assert.deepEqual(second.changes.map(c => c.entityId), ["concurrent"]);
  env.db.close();
});

test("filtered branch cursor advances only through a bounded page", async () => {
  const env = fakeD1();
  seedBaseline(env);
  append(env, "visible", "melati");
  append(env, "hidden", "kenanga");
  const identity = { email: "kasir@cuciin.id", role: "Kasir", branchIds: ["melati"], bootstrap: false };
  const page = await (await pullChanges(new Request("https://synthetic.test/v1/sync/changes?after=0"), env, identity)).json();
  assert.deepEqual(page.changes.map(c => c.entityId), ["visible"]);
  assert.equal(page.hasMore, false);
  assert.equal(page.latestRevision, 2);
  env.db.close();
});
