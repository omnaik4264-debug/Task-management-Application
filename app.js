// GitHub Pages version: browser-only storage (no Node.js backend required).
const $ = s => document.querySelector(s);
const USERS_KEY = "taskflow_pages_users";
const SESSION_KEY = "taskflow_pages_session";
let user = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let tasks = [];

function getUsers(){ return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
function saveUsers(users){ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function tasksKey(){ return `taskflow_pages_tasks_${user.email}`; }
function getTasks(){ return JSON.parse(localStorage.getItem(tasksKey()) || "[]"); }
function saveTasks(){ localStorage.setItem(tasksKey(), JSON.stringify(tasks)); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
function showAuth(register=false){ $("#authView").classList.remove("hidden"); $("#appView").classList.add("hidden"); switchTab(register); }
function switchTab(register){ $("#loginForm").classList.toggle("hidden",register); $("#registerForm").classList.toggle("hidden",!register); $("#loginTab").classList.toggle("active",!register); $("#registerTab").classList.toggle("active",register); }
$("#loginTab").onclick=()=>switchTab(false); $("#registerTab").onclick=()=>switchTab(true);

$("#registerForm").onsubmit=e=>{
 e.preventDefault();
 const name=$("#regName").value.trim(), email=$("#regEmail").value.trim().toLowerCase(), password=$("#regPassword").value;
 const users=getUsers();
 if(users.some(u=>u.email===email)){ toast("Account already exists"); return; }
 users.push({name,email,password}); saveUsers(users);
 user={name,email}; localStorage.setItem(SESSION_KEY,JSON.stringify(user)); startApp(); toast("Account created");
};

$("#loginForm").onsubmit=e=>{
 e.preventDefault();
 const email=$("#loginEmail").value.trim().toLowerCase(), password=$("#loginPassword").value;
 const found=getUsers().find(u=>u.email===email && u.password===password);
 if(!found){ toast("Invalid email or password"); return; }
 user={name:found.name,email:found.email}; localStorage.setItem(SESSION_KEY,JSON.stringify(user)); startApp(); toast("Login successful");
};

function logout(){ user=null; tasks=[]; localStorage.removeItem(SESSION_KEY); showAuth(false); }
$("#logoutBtn").onclick=logout;

function startApp(){
 if(!user){ showAuth(false); return; }
 $("#welcome").textContent=`Hi, ${user.name}`;
 $("#authView").classList.add("hidden"); $("#appView").classList.remove("hidden");
 tasks=getTasks(); loadTasks();
}

function loadTasks(){
 const q=$("#search").value.trim().toLowerCase(), s=$("#statusFilter").value, p=$("#priorityFilter").value;
 const filtered=tasks.filter(t=>(!q || `${t.title} ${t.description}`.toLowerCase().includes(q)) && (s==="all" || t.status===s) && (p==="all" || t.priority===p));
 render(filtered); updateStats();
}

function render(list){
 $("#taskGrid").innerHTML=""; $("#emptyState").classList.toggle("hidden",list.length>0);
 list.forEach(t=>{
  const c=document.createElement("article"); c.className="task-card";
  const statusClass=t.status.toLowerCase().replace(" ","-"), priority=t.priority.toLowerCase();
  c.innerHTML=`<div class="badges"><span class="badge ${priority}">${esc(t.priority)}</span><span class="badge ${statusClass}">${esc(t.status)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)||"No description provided."}</p><div class="due">Due: ${t.dueDate?formatDate(t.dueDate):"No deadline"}</div><div class="card-actions"><button class="ghost edit">Edit</button><button class="danger delete">Delete</button></div>`;
  c.querySelector(".edit").onclick=()=>openModal(t);
  c.querySelector(".delete").onclick=()=>deleteTask(t.id,t.title);
  $("#taskGrid").appendChild(c);
 });
}
function updateStats(){
 $("#totalCount").textContent=tasks.length;
 $("#pendingCount").textContent=tasks.filter(t=>t.status==="Pending").length;
 $("#progressCount").textContent=tasks.filter(t=>t.status==="In Progress").length;
 $("#completedCount").textContent=tasks.filter(t=>t.status==="Completed").length;
}
function openModal(t=null){
 $("#modal").classList.remove("hidden"); $("#modalTitle").textContent=t?"Edit Task":"New Task";
 $("#taskId").value=t?.id||""; $("#title").value=t?.title||""; $("#description").value=t?.description||""; $("#dueDate").value=t?.dueDate||""; $("#priority").value=t?.priority||"Medium"; $("#status").value=t?.status||"Pending"; $("#title").focus();
}
function closeModal(){ $("#modal").classList.add("hidden"); $("#taskForm").reset(); $("#taskId").value=""; }
$("#newTaskBtn").onclick=()=>openModal(); $("#closeModal").onclick=closeModal; $("#cancelBtn").onclick=closeModal;
$("#modal").onclick=e=>{ if(e.target===$("#modal")) closeModal(); };
$("#taskForm").onsubmit=e=>{
 e.preventDefault();
 const id=$("#taskId").value;
 const data={title:$("#title").value.trim(),description:$("#description").value.trim(),dueDate:$("#dueDate").value,priority:$("#priority").value,status:$("#status").value};
 if(!data.title){toast("Enter a task title");return;}
 if(id){ const i=tasks.findIndex(t=>t.id===id); if(i>=0) tasks[i]={...tasks[i],...data}; toast("Task updated"); }
 else { tasks.unshift({id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(),createdAt:new Date().toISOString(),...data}); toast("Task created"); }
 saveTasks(); closeModal(); loadTasks();
};
function deleteTask(id,title){ if(!confirm(`Delete "${title}"?`)) return; tasks=tasks.filter(t=>t.id!==id); saveTasks(); loadTasks(); toast("Task deleted"); }
let timer; $("#search").oninput=()=>{clearTimeout(timer);timer=setTimeout(loadTasks,200)}; $("#statusFilter").onchange=loadTasks; $("#priorityFilter").onchange=loadTasks;
function esc(v){const d=document.createElement("div");d.textContent=v??"";return d.innerHTML;}
function formatDate(s){return new Date(s+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}

user ? startApp() : showAuth(false);
