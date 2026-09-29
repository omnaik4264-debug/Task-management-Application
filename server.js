const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.APP_SECRET || "change-this-secret-before-production";
const DB_FILE = path.join(__dirname, "data", "db.json");
const PUBLIC = path.join(__dirname, "public");
const clients = new Map();

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { users: [], tasks: [] }; }
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function json(res, status, data) {
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8"});
  res.end(JSON.stringify(data));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => {
      data += c;
      if (data.length > 1e6) { reject(new Error("Request too large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
  });
}
function b64url(input) {
  return Buffer.from(input).toString("base64url");
}
function signToken(user) {
  const payload = b64url(JSON.stringify({ id:user.id, email:user.email, exp:Date.now()+24*60*60*1000 }));
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}
function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
function auth(req) {
  const h = req.headers.authorization || "";
  return verifyToken(h.startsWith("Bearer ") ? h.slice(7) : "");
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
function checkPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}
function clean(s, max=500) { return String(s ?? "").trim().slice(0,max); }
function emit(userId, event="tasks-changed") {
  const set = clients.get(userId);
  if (!set) return;
  for (const res of set) res.write(`event: ${event}\ndata: ${JSON.stringify({time:Date.now()})}\n\n`);
}
function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC, requested));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const ext = path.extname(file);
  const types = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".svg":"image/svg+xml"};
  res.writeHead(200, {"Content-Type": types[ext] || "application/octet-stream"});
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;

  try {
    if (p === "/api/register" && req.method === "POST") {
      const b = await body(req);
      const name = clean(b.name, 60), email = clean(b.email, 120).toLowerCase(), password = String(b.password || "");
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6)
        return json(res, 400, {message:"Enter a name, valid email and password of at least 6 characters."});
      const db = readDB();
      if (db.users.some(u => u.email === email)) return json(res, 409, {message:"An account with this email already exists."});
      const hp = hashPassword(password);
      const user = {id:crypto.randomUUID(), name, email, passwordHash:hp.hash, salt:hp.salt, createdAt:new Date().toISOString()};
      db.users.push(user); writeDB(db);
      return json(res, 201, {token:signToken(user), user:{id:user.id,name:user.name,email:user.email}});
    }

    if (p === "/api/login" && req.method === "POST") {
      const b = await body(req);
      const email = clean(b.email,120).toLowerCase(), password = String(b.password || "");
      const db = readDB(), user = db.users.find(u => u.email === email);
      if (!user || !checkPassword(password, user.salt, user.passwordHash))
        return json(res, 401, {message:"Invalid email or password."});
      return json(res, 200, {token:signToken(user), user:{id:user.id,name:user.name,email:user.email}});
    }

    if (p === "/api/events" && req.method === "GET") {
      const user = verifyToken(url.searchParams.get("token"));
      if (!user) return json(res,401,{message:"Unauthorized"});
      res.writeHead(200, {"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
      res.write("event: connected\ndata: {}\n\n");
      if (!clients.has(user.id)) clients.set(user.id, new Set());
      clients.get(user.id).add(res);
      req.on("close", () => clients.get(user.id)?.delete(res));
      return;
    }

    if (p.startsWith("/api/")) {
      const user = auth(req);
      if (!user) return json(res, 401, {message:"Unauthorized. Please log in."});
      const db = readDB();

      if (p === "/api/me" && req.method === "GET") {
        const u = db.users.find(x => x.id === user.id);
        if (!u) return json(res,404,{message:"User not found."});
        return json(res,200,{id:u.id,name:u.name,email:u.email});
      }

      if (p === "/api/tasks" && req.method === "GET") {
        const status = url.searchParams.get("status") || "all";
        const priority = url.searchParams.get("priority") || "all";
        const q = clean(url.searchParams.get("q") || "",100).toLowerCase();
        let tasks = db.tasks.filter(t => t.userId === user.id);
        if (status !== "all") tasks = tasks.filter(t => t.status === status);
        if (priority !== "all") tasks = tasks.filter(t => t.priority === priority);
        if (q) tasks = tasks.filter(t => (t.title+" "+t.description).toLowerCase().includes(q));
        tasks.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
        return json(res,200,tasks);
      }

      if (p === "/api/tasks" && req.method === "POST") {
        const b = await body(req);
        const title = clean(b.title,120);
        if (!title) return json(res,400,{message:"Task title is required."});
        const allowedP = ["Low","Medium","High"], allowedS = ["Pending","In Progress","Completed"];
        const task = {
          id:crypto.randomUUID(), userId:user.id, title,
          description:clean(b.description,1000),
          dueDate: /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || "") ? b.dueDate : "",
          priority: allowedP.includes(b.priority) ? b.priority : "Medium",
          status: allowedS.includes(b.status) ? b.status : "Pending",
          createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
        };
        db.tasks.push(task); writeDB(db); emit(user.id);
        return json(res,201,task);
      }

      const m = p.match(/^\/api\/tasks\/([a-f0-9-]+)$/i);
      if (m) {
        const idx = db.tasks.findIndex(t => t.id === m[1] && t.userId === user.id);
        if (idx < 0) return json(res,404,{message:"Task not found."});

        if (req.method === "PUT") {
          const b = await body(req), old = db.tasks[idx];
          const allowedP = ["Low","Medium","High"], allowedS = ["Pending","In Progress","Completed"];
          const title = clean(b.title,120);
          if (!title) return json(res,400,{message:"Task title is required."});
          db.tasks[idx] = {...old, title, description:clean(b.description,1000),
            dueDate:/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || "") ? b.dueDate : "",
            priority:allowedP.includes(b.priority)?b.priority:old.priority,
            status:allowedS.includes(b.status)?b.status:old.status,
            updatedAt:new Date().toISOString()};
          writeDB(db); emit(user.id);
          return json(res,200,db.tasks[idx]);
        }
        if (req.method === "DELETE") {
          db.tasks.splice(idx,1); writeDB(db); emit(user.id);
          return json(res,200,{message:"Task deleted."});
        }
      }
      return json(res,404,{message:"API route not found."});
    }

    if (!serveStatic(req,res,p)) {
      res.writeHead(404,{"Content-Type":"text/plain"}); res.end("Not found");
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res,500,{message:"Server error."});
  }
});

server.listen(PORT, () => console.log(`Task Manager running at http://localhost:${PORT}`));
