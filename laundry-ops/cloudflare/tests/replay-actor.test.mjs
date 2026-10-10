import assert from "node:assert/strict";
import test from "node:test";
import { pushCommands } from "../src/command-sync.ts";
import { fakeD1, seedBaseline, identities, commandRequest } from "./support/d1-harness.mjs";

const command={commandId:"replay-actor-command",entityType:"customer",entityId:"customer-a",operation:"upsert",payload:{id:"customer-a",name:"Synthetic",phone:"",address:""}};
const send=async(env,actor)=>(await pushCommands(commandRequest([command]),env,actor)).json();
test("concurrent processed command cannot acknowledge another actor",async()=>{
  const env=fakeD1();seedBaseline(env);
  try {
    const batch=env.batch.bind(env);
    env.batch=async statements=>{
      env.db.prepare("INSERT INTO processed_commands(command_id,organization_id,processed_at,actor_email,result_json) VALUES(?,'cuciin',1,?,?)").run(command.commandId,identities.kasirLain.email,JSON.stringify({commandId:command.commandId,accepted:true}));
      return batch(statements);
    };
    const result=(await send(env,identities.kasir)).results[0];
    assert.equal(result.accepted,false,JSON.stringify(result));assert.equal(result.code,409);
    assert.equal(env.db.prepare("SELECT count(*) n FROM customers").get().n,0);
    assert.equal(env.db.prepare("SELECT count(*) n FROM sync_changes").get().n,0);
    assert.equal(env.db.prepare("SELECT actor_email FROM processed_commands").get().actor_email,identities.kasirLain.email);
  } finally {env.db.close();}
});

for(const other of [identities.kasirLain,identities.owner]) test(`replay cannot acknowledge another actor ${other.role}`,async()=>{
  const env=fakeD1();seedBaseline(env);
  try {
    assert.equal((await send(env,identities.kasir)).results[0].accepted,true);
    const before=env.db.prepare("SELECT * FROM processed_commands").all();
    const journals=env.db.prepare("SELECT count(*) n FROM sync_changes").get().n;
    const result=(await send(env,other)).results[0];
    assert.equal(result.accepted,false,JSON.stringify(result));assert.equal(result.code,409);
    assert.deepEqual(env.db.prepare("SELECT * FROM processed_commands").all(),before);
    assert.equal(env.db.prepare("SELECT count(*) n FROM sync_changes").get().n,journals);
    const original=(await send(env,{...identities.kasir,email:identities.kasir.email.toUpperCase()})).results[0];
    assert.equal(original.accepted,true);assert.equal(original.replayed,true);
  } finally {env.db.close();}
});
