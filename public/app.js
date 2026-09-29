const $=s=>document.querySelector(s);
let token=localStorage.getItem("taskflow_token")||"", user=null, tasks=[], stream=null;
const api=async(path,options={})=>{
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  const r=await fetch(path,{...options,headers});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){if(r.status===401&&path!=="/api/login"){logout();}throw new Error(d.message||"Request failed");}
  return d;
};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function showAuth(register=false){$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden");switchTab(register)}
function switchTab(register){$("#loginForm").classList.toggle("hidden",register);$("#registerForm").classList.toggle("hidden",!register);$("#loginTab").classList.toggle("active",!register);$("#registerTab").classList.toggle("active",register)}
$("#loginTab").onclick=()=>switchTab(false);$("#registerTab").onclick=()=>switchTab(true);
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({email:$("#loginEmail").value,password:$("#loginPassword").value})});token=d.token;localStorage.setItem("taskflow_token",token);await startApp()}catch(e){toast(e.message)}};
$("#registerForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/register",{method:"POST",body:JSON.stringify({name:$("#regName").value,email:$("#regEmail").value,password:$("#regPassword").value})});token=d.token;localStorage.setItem("taskflow_token",token);await startApp();toast("Account created")}catch(e){toast(e.message)}};
function logout(){token="";user=null;localStorage.removeItem("taskflow_token");stream?.close();showAuth(false)}
$("#logoutBtn").onclick=logout;
async function startApp(){try{user=await api("/api/me");$("#welcome").textContent=`Hi, ${user.name}`;$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");await loadTasks();connectEvents()}catch{logout()}}
function connectEvents(){stream?.close();stream=new EventSource(`/api/events?token=${encodeURIComponent(token)}`);stream.addEventListener("tasks-changed",()=>loadTasks())}
async function loadTasks(){try{const q=encodeURIComponent($("#search").value),s=encodeURIComponent($("#statusFilter").value),p=encodeURIComponent($("#priorityFilter").value);tasks=await api(`/api/tasks?q=${q}&status=${s}&priority=${p}`);render()}catch(e){toast(e.message)}}
function render(){
 $("#taskGrid").innerHTML="";$("#emptyState").classList.toggle("hidden",tasks.length>0);
 tasks.forEach(t=>{
  const c=document.createElement("article");c.className="task-card";
  const statusClass=t.status.toLowerCase().replace(" ","-"), priority=t.priority.toLowerCase();
  c.innerHTML=`<div class="badges"><span class="badge ${priority}">${esc(t.priority)}</span><span class="badge ${statusClass}">${esc(t.status)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)||"No description provided."}</p><div class="due">Due: ${t.dueDate?formatDate(t.dueDate):"No deadline"}</div><div class="card-actions"><button class="ghost edit">Edit</button><button class="danger delete">Delete</button></div>`;
  c.querySelector(".edit").onclick=()=>openModal(t);c.querySelector(".delete").onclick=()=>deleteTask(t.id,t.title);$("#taskGrid").appendChild(c);
 });
 updateStats();
}
async function updateStats(){
 try{
  const all=await api("/api/tasks");
  $("#totalCount").textContent=all.length;$("#pendingCount").textContent=all.filter(t=>t.status==="Pending").length;$("#progressCount").textContent=all.filter(t=>t.status==="In Progress").length;$("#completedCount").textContent=all.filter(t=>t.status==="Completed").length;
 }catch{}
}
function openModal(t=null){$("#modal").classList.remove("hidden");$("#modalTitle").textContent=t?"Edit Task":"New Task";$("#taskId").value=t?.id||"";$("#title").value=t?.title||"";$("#description").value=t?.description||"";$("#dueDate").value=t?.dueDate||"";$("#priority").value=t?.priority||"Medium";$("#status").value=t?.status||"Pending";$("#title").focus()}
function closeModal(){$("#modal").classList.add("hidden");$("#taskForm").reset();$("#taskId").value=""}
$("#newTaskBtn").onclick=()=>openModal();$("#closeModal").onclick=closeModal;$("#cancelBtn").onclick=closeModal;
$("#modal").onclick=e=>{if(e.target===$("#modal"))closeModal()};
$("#taskForm").onsubmit=async e=>{e.preventDefault();const id=$("#taskId").value,data={title:$("#title").value,description:$("#description").value,dueDate:$("#dueDate").value,priority:$("#priority").value,status:$("#status").value};try{await api(id?`/api/tasks/${id}`:"/api/tasks",{method:id?"PUT":"POST",body:JSON.stringify(data)});closeModal();await loadTasks();toast(id?"Task updated":"Task created")}catch(e){toast(e.message)}};
async function deleteTask(id,title){if(!confirm(`Delete "${title}"?`))return;try{await api(`/api/tasks/${id}`,{method:"DELETE"});await loadTasks();toast("Task deleted")}catch(e){toast(e.message)}}
let timer;$("#search").oninput=()=>{clearTimeout(timer);timer=setTimeout(loadTasks,250)};$("#statusFilter").onchange=loadTasks;$("#priorityFilter").onchange=loadTasks;
function esc(v){const d=document.createElement("div");d.textContent=v??"";return d.innerHTML}
function formatDate(s){return new Date(s+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
token?startApp():showAuth(false);