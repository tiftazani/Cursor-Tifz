import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import * as worker from "../src/index.ts";
import { fakeD1, seedBaseline } from "./support/d1-harness.mjs";
import { readFileSync } from "node:fs";
import { loginContract } from "./fixtures/login-contract.mjs";

test("Worker login and legacy nota match the fixture decoded by Kotlin",async()=>{
  const fixture=JSON.parse(readFileSync(new URL("../../android/app/src/test/resources/worker-login-contract.json",import.meta.url),"utf8"));
  assert.deepEqual(await loginContract(),fixture);
});


test("/v1/me verifies signed synthetic token and returns compact access without journal reads",async()=>{
  const env=fakeD1();seedBaseline(env);env.FIREBASE_PROJECT_ID="synthetic-project";
  env.db.exec("UPDATE staff SET firebase_uid='synthetic-uid' WHERE email='kasir@cuciin.id'");
  const queries=[];const prepare=env.prepare.bind(env);
  env.prepare=sql=>{queries.push(sql);return prepare(sql);};
  const keys=generateKeyPairSync("rsa",{modulusLength:2048});
  const jwk={...keys.publicKey.export({format:"jwk"}),kid:"synthetic-key",alg:"RS256"};
  const b64=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const now=Math.floor(Date.now()/1000);
  const data=b64({alg:"RS256",kid:jwk.kid})+"."+b64({aud:env.FIREBASE_PROJECT_ID,iss:`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,sub:"synthetic-uid",email:"kasir@cuciin.id",iat:now,exp:now+300});
  const token=data+"."+sign("RSA-SHA256",Buffer.from(data),keys.privateKey).toString("base64url");
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{assert.ok(String(url).includes("googleapis.com/service_accounts/v1/jwk/"));return Response.json({keys:[jwk]});};
  try {
    const response=await worker.default.fetch(new Request("https://synthetic.test/v1/me",{headers:{authorization:`Bearer ${token}`}}),env);
    assert.equal(response.status,200);const identity=await response.json();
    assert.equal(identity.email,"kasir@cuciin.id");assert.equal(identity.access.staff.length,1);
    assert.deepEqual(identity.access.staff[0].branchIds,["melati"]);
    assert.equal(identity.access.staff[0].approved,true);
    assert.ok(!queries.some(sql=>/sync_changes|sync_snapshots|orders/.test(sql)));
    assert.ok(queries.length<=6,`compact queries ${queries.length}`);
    const invalid=data+"."+Buffer.alloc(256).toString("base64url");
    assert.equal((await worker.default.fetch(new Request("https://synthetic.test/v1/me",{headers:{authorization:`Bearer ${invalid}`}}),env)).status,401);
  } finally {globalThis.fetch=original;env.db.close();}
});

test("compact access reads only normalized own staff, full roles and own policy", async () => {
  const env=fakeD1(); seedBaseline(env);
  env.db.exec(`UPDATE staff SET access_role_id='custom-empty' WHERE email='kasir@cuciin.id';
    INSERT INTO access_roles VALUES('custom-empty','cuciin','Empty',0,'{"modules":[],"functions":[]}',1);
    INSERT INTO access_roles VALUES('role-kasir','cuciin','Kasir',1,'{"modules":["service"],"functions":["service.create"]}',1);
    INSERT INTO access_policies VALUES('kasir@cuciin.id','cuciin','{"modules":[],"functions":[]}',1);
    INSERT INTO access_policies VALUES('rekan@cuciin.id','cuciin','{"modules":["service"],"functions":["service.create"]}',1);`);
  assert.equal(typeof worker.compactAccessSnapshot,"function","compact helper missing; login still needs full business snapshot");
  const queries=[];
  const prepare=env.prepare.bind(env);
  env.prepare=sql=>{queries.push(sql); return prepare(sql);};
  const snapshot=await worker.compactAccessSnapshot(env,"KASIR@CUCIIN.ID");
  assert.deepEqual(snapshot.staff,[{name:"Kasir Melati",email:"kasir@cuciin.id",role:"Kasir",approved:true,branchIds:["melati"],accessRoleId:"custom-empty"}]);
  assert.equal(snapshot.accessRoles.length,2);
  assert.deepEqual(snapshot.accessRoles.find(r=>r.id==="custom-empty"),{id:"custom-empty",name:"Empty",builtIn:false,modules:[],functions:[]});
  assert.deepEqual(snapshot.accessPolicies,[{email:"kasir@cuciin.id",modules:[],functions:[]}]);
  assert.ok(!queries.some(sql=>/sync_changes|sync_snapshots|orders/.test(sql)),"access must not replay business data");
  env.db.exec("UPDATE staff SET access_role_id='missing' WHERE email='kasir@cuciin.id'");
  assert.equal((await worker.compactAccessSnapshot(env,"kasir@cuciin.id")).staff[0].accessRoleId,"missing");
  env.db.exec("UPDATE staff SET approved=0 WHERE email='kasir@cuciin.id'");
  assert.deepEqual((await worker.compactAccessSnapshot(env,"kasir@cuciin.id")).staff,[]);
  env.db.close();
});
