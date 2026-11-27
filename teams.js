import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let db, auth, isAdminFn;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const niceDate = d => { const x = new Date(d + "T12:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
const DEFAULT_TEAMS = ["Team 1", "Team 2", "Team 3", "Team 4"];

export function initTeams(opts) {
  db = opts.db; auth = opts.auth; isAdminFn = opts.isAdmin;
  const btn = document.getElementById("navTeams");
  if (btn) btn.addEventListener("click", showTeamsView);
  // hide Teams view when any other nav button is pressed
  document.querySelectorAll("nav button, .bottom-nav button, .nav-btn").forEach(b => {
    if (b.id !== "navTeams") b.addEventListener("click", () => {
      const v = document.getElementById("teamsView"); if (v) v.style.display = "none";
      if (btn) btn.classList.remove("active");
    });
  });
}

export function showTeamsView() {
  const view = document.getElementById("teamsView");
  [...view.parentElement.children].forEach(el => { if (el.id && el.id.endsWith("View")) el.style.display = "none"; });
  document.querySelectorAll("nav button, .bottom-nav button, .nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("navTeams")?.classList.add("active");
  view.style.display = "block";
  loadTeams();
}

async function getTeams() {
  const snap = await getDocs(collection(db, "teams"));
  let teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!teams.length) {
    for (let i = 0; i < 4; i++) await setDoc(doc(db, "teams", "team-" + (i + 1)), { name: DEFAULT_TEAMS[i], order: i + 1 });
    return getTeams();
  }
  return teams.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function summarise(fixtures) {
  const s = { p: 0, w: 0, d: 0, l: 0, f: 0, a: 0 };
  fixtures.forEach(x => {
    if (x.scoreFor == null || x.scoreAgainst == null) return;
    s.p++; s.f += x.scoreFor; s.a += x.scoreAgainst;
    if (x.scoreFor > x.scoreAgainst) s.w++; else if (x.scoreFor < x.scoreAgainst) s.l++; else s.d++;
  });
  return s;
}

function leagueHtml(text) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return "";
  const rows = lines.map((l, i) => "<tr>" + l.split(",").map(c => (i === 0 ? "<th>" : "<td>") + esc(c.trim()) + (i === 0 ? "</th>" : "</td>")).join("") + "</tr>").join("");
  return `<h4 style="margin:12px 0 4px">League table</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table></div>`;
}

async function loadTeams() {
  const box = document.getElementById("teamsContent");
  box.innerHTML = "<p>Loading…</p>";
  try {
    const uid = auth.currentUser.uid;
    const [teams, fSnap, lSnap, me] = await Promise.all([
      getTeams(), getDocs(collection(db, "teamFixtures")), getDocs(collection(db, "leagueTables")), getDoc(doc(db, "members", uid))
    ]);
    const captainOf = (me.exists() && me.data().captainOf) || [];
    const admin = isAdminFn();
    const fixtures = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tables = {}; lSnap.docs.forEach(d => tables[d.id] = d.data().text);
    box.innerHTML = "";
    teams.forEach(t => {
      const fx = fixtures.filter(f => f.teamId === t.id).sort((a, b) => a.date.localeCompare(b.date));
      const s = summarise(fx);
      const card = document.createElement("div");
      card.className = "game-card";
      card.style.marginBottom = "16px";
      const isCaptain = captainOf.includes(t.id);
      card.innerHTML = `<h3 style="margin:0 0 4px">${esc(t.name)}</h3>
        <div style="font-size:14px;margin-bottom:8px"><b>Played ${s.p}</b> · Won ${s.w} · Drawn ${s.d} · Lost ${s.l} · For ${s.f} · Against ${s.a}</div>
        ${isCaptain ? `<div class="cap-box" style="background:#f0f7f0;padding:8px;border-radius:8px;margin-bottom:8px"><b>Captain: enter result</b><br>
          <select class="cap-fix" style="width:100%;margin:6px 0">${fx.map(f => `<option value="${f.id}">${esc(niceDate(f.date))} – ${esc(f.opponent)} (${esc(f.venue)})${f.scoreFor != null ? " – " + f.scoreFor + "-" + f.scoreAgainst : ""}</option>`).join("")}</select>
          <input class="cap-for" type="number" min="0" placeholder="Us" style="width:70px"> – <input class="cap-ag" type="number" min="0" placeholder="Them" style="width:70px">
          <button class="cap-save">Save result</button></div>` : ""}
        ${fx.length ? "" : "<p>No fixtures entered yet.</p>"}
        ${fx.map(f => {
          const done = f.scoreFor != null;
          const res = done ? (f.scoreFor > f.scoreAgainst ? "W" : f.scoreFor < f.scoreAgainst ? "L" : "D") : "";
          return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #eee;font-size:14px">
            <span>${esc(niceDate(f.date))} – ${esc(f.opponent)} (${esc(f.venue)})</span>
            <span>${done ? `<b>${res} ${f.scoreFor}-${f.scoreAgainst}</b>` : "<span style='color:#888'>to play</span>"}${admin ? ` <button class="fx-del" data-id="${f.id}" style="margin-left:6px">✕</button>` : ""}</span></div>`;
        }).join("")}
        ${leagueHtml(tables[t.id])}`;
      box.appendChild(card);
      const save = card.querySelector(".cap-save");
      if (save) save.addEventListener("click", async () => {
        const id = card.querySelector(".cap-fix").value;
        const a = parseInt(card.querySelector(".cap-for").value, 10), b = parseInt(card.querySelector(".cap-ag").value, 10);
        if (!id || isNaN(a) || isNaN(b)) { alert("Please pick a fixture and enter both scores."); return; }
        await updateDoc(doc(db, "teamFixtures", id), { scoreFor: a, scoreAgainst: b, resultBy: uid, resultAt: Date.now() });
        loadTeams();
      });
      card.querySelectorAll(".fx-del").forEach(b => b.addEventListener("click", async () => {
        if (confirm("Delete this fixture?")) { await deleteDoc(doc(db, "teamFixtures", b.dataset.id)); loadTeams(); }
      }));
    });
  } catch (e) { console.error(e); box.innerHTML = "<p>Could not load teams: " + esc(e.message) + "</p>"; }
}

// ---------- Admin section ----------
export async function loadTeamsAdmin() {
  const adminView = document.getElementById("adminView");
  if (!adminView) return;
  let box = document.getElementById("teamsAdminBox");
  if (!box) { box = document.createElement("div"); box.id = "teamsAdminBox"; adminView.appendChild(box); }
  box.innerHTML = "<h3>Teams</h3><p>Loading…</p>";
  const [teams, mSnap, lSnap] = await Promise.all([getTeams(), getDocs(collection(db, "members")), getDocs(collection(db, "leagueTables"))]);
  const members = mSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.firstName)
    .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName));
  const tables = {}; lSnap.docs.forEach(d => tables[d.id] = d.data().text || "");
  const teamOpts = teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const captains = members.filter(m => (m.captainOf || []).length);
  box.innerHTML = `<h3>Teams</h3>
    <h4>Team names</h4>
    ${teams.map(t => `<input class="tn" data-id="${t.id}" value="${esc(t.name)}" style="display:block;width:100%;margin:4px 0">`).join("")}
    <button id="tnSave">Save names</button>
    <h4>Add fixtures</h4>
    <select id="fxTeam" style="width:100%">${teamOpts}</select>
    <textarea id="fxText" rows="6" style="width:100%;margin-top:6px" placeholder="One per line: date, opponent, H or A&#10;2027-04-21, Smalltown TC, H&#10;2027-04-28, Other Club, A"></textarea>
    <button id="fxAdd">Add fixtures</button>
    <h4>Captains</h4>
    ${captains.map(m => `<div>${esc(m.firstName)} ${esc(m.lastName)} – ${m.captainOf.map(id => esc(teams.find(t => t.id === id)?.name || id)).join(", ")}
      <button class="capRm" data-uid="${m.id}" data-team="${m.captainOf.join(",")}">Remove</button></div>`).join("") || "<p>None set.</p>"}
    <select id="capMember" style="width:100%;margin-top:6px">${members.map(m => `<option value="${m.id}">${esc(m.firstName)} ${esc(m.lastName)}</option>`).join("")}</select>
    <select id="capTeam" style="width:100%;margin-top:4px">${teamOpts}</select>
    <button id="capAdd">Make captain</button>
    <h4>League tables (typed in)</h4>
    <p style="font-size:13px;color:#666">First line = headings, then one line per club, comma-separated. e.g.<br>Team, P, W, D, L, Pts</p>
    ${teams.map(t => `<b>${esc(t.name)}</b><textarea class="lt" data-id="${t.id}" rows="5" style="width:100%">${esc(tables[t.id] || "")}</textarea>`).join("")}
    <button id="ltSave">Save league tables</button>`;

  box.querySelector("#tnSave").onclick = async () => {
    for (const i of box.querySelectorAll(".tn")) await updateDoc(doc(db, "teams", i.dataset.id), { name: i.value.trim() });
    alert("Saved"); loadTeamsAdmin();
  };
  box.querySelector("#fxAdd").onclick = async () => {
    const teamId = box.querySelector("#fxTeam").value; let n = 0, bad = [];
    for (const line of box.querySelector("#fxText").value.split("\n").map(l => l.trim()).filter(Boolean)) {
      const [date, opponent, v] = line.split(",").map(x => x.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !opponent) { bad.push(line); continue; }
      await addDoc(collection(db, "teamFixtures"), { teamId, date, opponent, venue: /^a/i.test(v || "") ? "Away" : "Home", scoreFor: null, scoreAgainst: null });
      n++;
    }
    alert(n + " added" + (bad.length ? ". Could not read:\n" + bad.join("\n") : ""));
    box.querySelector("#fxText").value = bad.join("\n");
  };
  box.querySelector("#capAdd").onclick = async () => {
    await updateDoc(doc(db, "members", box.querySelector("#capMember").value), { captainOf: arrayUnion(box.querySelector("#capTeam").value) });
    loadTeamsAdmin();
  };
  box.querySelectorAll(".capRm").forEach(b => b.onclick = async () => {
    for (const t of b.dataset.team.split(",")) await updateDoc(doc(db, "members", b.dataset.uid), { captainOf: arrayRemove(t) });
    loadTeamsAdmin();
  });
  box.querySelector("#ltSave").onclick = async () => {
    for (const t of box.querySelectorAll(".lt")) await setDoc(doc(db, "leagueTables", t.dataset.id), { text: t.value });
    alert("Saved");
  };
}