const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .find(source => source.includes("const App ="));

const pendingRow = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Pending Member",
  role: "Engineer",
  class_id: null,
  avatar_id: null,
  level: 1
};

const assignedRow = {
  id: "20000000-0000-4000-8000-000000000002",
  name: "Assigned Member",
  role: "Product Owner",
  class_id: "pm",
  avatar_id: "a2",
  level: 12
};

function response(data, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => data };
}

async function boot(search, memberRow) {
  const appElement = { innerHTML: "" };
  const calls = [];
  const context = {
    console,
    URLSearchParams,
    location: { search },
    document: { getElementById: () => appElement },
    window: {
      INV_GUILD_CONFIG: {
        supabaseUrl: "https://example.supabase.co",
        supabasePublishableKey: "public-test-key"
      }
    },
    fetch: async (url, options = {}) => {
      if (url.startsWith("data/")) {
        return response(JSON.parse(fs.readFileSync(path.join(root, url), "utf8")));
      }

      const rpc = url.split("/").pop();
      calls.push({ rpc, body: options.body ? JSON.parse(options.body) : {} });
      if (rpc === "list_assigned_members") return response([assignedRow]);
      if (rpc === "get_member_by_id") return response(memberRow ? [memberRow] : []);
      if (rpc === "assign_member_class") {
        const body = JSON.parse(options.body);
        return response([{ ...pendingRow, class_id: body.p_class_id, avatar_id: body.p_avatar_id, level: 1 }]);
      }
      return response({ message: "Unexpected RPC" }, false);
    },
    setTimeout,
    clearTimeout
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appSource + ";globalThis.__App = App; globalThis.__quizLength = () => QS.length;", context);
  await new Promise(resolve => setTimeout(resolve, 20));
  return { App: context.__App, appElement, calls };
}

async function run() {
  const guest = await boot("", null);
  assert.equal(guest.App.state.screen, "welcome");
  assert.equal(guest.App.state.mode, "guest");
  assert.match(guest.appElement.innerHTML, /เลือกอาชีพ/);
  guest.App.goHomePrimary();
  assert.equal(guest.App.state.screen, "avatar");

  const pending = await boot("?id=" + pendingRow.id, pendingRow);
  assert.equal(pending.App.state.screen, "welcome");
  assert.equal(pending.App.state.mode, "member");
  assert.match(pending.appElement.innerHTML, /เลือกอาชีพ/);
  pending.App.goHomePrimary();
  assert.equal(pending.App.state.screen, "avatar");
  assert.match(pending.appElement.innerHTML, /readonly/);
  pending.App.state.qi = 7;
  await pending.App.answer(7, 0);
  assert.equal(pending.App.state.screen, "memberProfile");
  assert.equal(pending.calls.filter(call => call.rpc === "assign_member_class").length, 1);

  const assigned = await boot("?id=" + assignedRow.id, assignedRow);
  assert.equal(assigned.App.state.screen, "welcome");
  assert.match(assigned.appElement.innerHTML, /ดูข้อมูลของท่าน/);
  assigned.App.goHomePrimary();
  assert.equal(assigned.App.state.screen, "memberProfile");
  assert.match(assigned.appElement.innerHTML, /Assigned Member/);
  assert.match(assigned.appElement.innerHTML, /Product Owner/);
  assert.doesNotMatch(assigned.appElement.innerHTML, /ทำแบบทดสอบใหม่/);
  assigned.App.openClass("pm");
  assert.equal(assigned.App.state.screen, "classDetail");
  assert.doesNotMatch(assigned.appElement.innerHTML, /Assigned Member|Product Owner/);

  const missing = await boot("?id=20000000-0000-4000-8000-000000000099", null);
  assert.equal(missing.App.state.screen, "error");
  assert.match(missing.appElement.innerHTML, /ไม่พบสมาชิก/);

  console.log("smoke tests: OK");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});