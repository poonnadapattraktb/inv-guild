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
  id: "Uk8a1FT9",
  name: "Pending Member",
  role: "Engineer",
  class_id: null,
  avatar_id: null,
  level: 1
};

const assignedRow = {
  id: "Aa2Bb3Cc",
  name: "Assigned Member",
  role: "Product Owner",
  class_id: "pm",
  avatar_id: "a2",
  level: 12
};

function response(data, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => data };
}

async function boot(search, memberRow, pathname = "/inv-guild/") {
  const appElement = { innerHTML: "" };
  const calls = [];
  const context = {
    console,
    URLSearchParams,
    location: { search, pathname },
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

      const u = new URL(url);
      const method = (options.method || "GET").toUpperCase();
      assert.equal(u.pathname, "/rest/v1/members");
      const idFilter = u.searchParams.get("id");
      const id = idFilter ? idFilter.replace(/^eq\./, "") : null;

      if (method === "PATCH") {
        const body = JSON.parse(options.body);
        calls.push({ type: "assign", id, body });
        if (id === pendingRow.id) {
          return response([{ ...pendingRow, class_id: body.class_id, avatar_id: body.avatar_id, assigned_at: body.assigned_at }]);
        }
        return response([]);
      }

      if (u.searchParams.get("class_id") === "not.is.null") {
        calls.push({ type: "list" });
        return response([assignedRow]);
      }

      calls.push({ type: "get", id });
      if (id === pendingRow.id) return response(pendingRow);
      if (id === assignedRow.id) return response(assignedRow);
      return response({ message: "not found" }, false, 406);
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
  assert.match(pending.appElement.innerHTML, /GUEST MODE/);
  pending.App.playAsGuest();
  assert.equal(pending.App.state.mode, "guest");
  assert.equal(pending.App.state.memberId, null);
  assert.equal(pending.App.state.screen, "avatar");

  const pendingAssignment = await boot("?id=" + pendingRow.id, pendingRow);
  pendingAssignment.App.goHomePrimary();
  assert.equal(pendingAssignment.App.state.screen, "avatar");
  assert.doesNotMatch(pendingAssignment.appElement.innerHTML, /readonly/);
  pendingAssignment.App.setNickname("ป๊อกแป๊ก");
  pendingAssignment.App.state.qi = 7;
  await pendingAssignment.App.answer(7, 0);
  assert.equal(pendingAssignment.App.state.screen, "joinYear");

  const futureYear = new Date().getFullYear() + 1;
  pendingAssignment.App.setJoinYearInput(String(futureYear));
  await pendingAssignment.App.confirmJoinYear();
  assert.equal(pendingAssignment.App.state.screen, "joinYear");
  assert.ok(pendingAssignment.App.state.joinYearError);

  pendingAssignment.App.setJoinYearInput("2565"); // พ.ศ. 2565 -> ค.ศ. 2022
  await pendingAssignment.App.confirmJoinYear();
  assert.equal(pendingAssignment.App.state.screen, "memberProfile");
  const assignCalls = pendingAssignment.calls.filter(call => call.type === "assign");
  assert.equal(assignCalls.length, 1);
  assert.equal(assignCalls[0].body.nickname, "ป๊อกแป๊ก");
  assert.equal(assignCalls[0].body.joined_at, 2022);

  const assigned = await boot("?id=" + assignedRow.id, assignedRow);
  assert.equal(assigned.App.state.screen, "welcome");
  assert.equal(assigned.App.state.memberId, assignedRow.id);
  assert.match(assigned.appElement.innerHTML, /ดูข้อมูลของท่าน/);
  assigned.App.goHomePrimary();
  assert.equal(assigned.App.state.screen, "memberProfile");
  assert.match(assigned.appElement.innerHTML, /Assigned Member/);
  assert.match(assigned.appElement.innerHTML, /Product Owner/);
  assert.doesNotMatch(assigned.appElement.innerHTML, /ทำแบบทดสอบใหม่/);
  assigned.App.openClass("pm");
  assert.equal(assigned.App.state.screen, "classDetail");
  assert.doesNotMatch(assigned.appElement.innerHTML, /Assigned Member|Product Owner/);

  const missing = await boot("?id=Missing9", null);
  assert.equal(missing.App.state.screen, "error");
  assert.match(missing.appElement.innerHTML, /ไม่พบสมาชิก/);

  const invalid = await boot("?id=eq." + pendingRow.id, null);
  assert.equal(invalid.App.state.screen, "error");
  assert.match(invalid.appElement.innerHTML, /รูปแบบ ID/);

  console.log("smoke tests: OK");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});