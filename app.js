/* Simple chat engine (client-only)
   - Stores users and messages in localStorage
   - Passwords are hashed using SHA-256 before storing
*/

const LS_USERS_KEY = 'simplechat_users';
const LS_MSGS_KEY  = 'simplechat_messages';

/* ------------------ ADDED FOR SESSION PERSISTENCE ------------------ */
function saveCurrentUser(u){
  if(u) localStorage.setItem('simplechat_currentUser', JSON.stringify(u));
  else localStorage.removeItem('simplechat_currentUser');
}
function loadCurrentUser(){
  try {
    return JSON.parse(localStorage.getItem('simplechat_currentUser'));
  } catch(e){
    return null;
  }
}
/* -------------------------------------------------------------------- */

function nowTs(){ return new Date().toISOString(); }
function fmtTime(iso){
  const d = new Date(iso);
  return d.toLocaleString();
}

/* --- storage helpers --- */
function loadUsers(){
  try {
    return JSON.parse(localStorage.getItem(LS_USERS_KEY) || '[]');
  } catch(e){ return []; }
}
function saveUsers(users){
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
}

function loadMessages(){
  try {
    return JSON.parse(localStorage.getItem(LS_MSGS_KEY) || '[]');
  } catch(e){ return []; }
}
function saveMessages(msgs){
  localStorage.setItem(LS_MSGS_KEY, JSON.stringify(msgs));
}

/* --- crypto: hash password (UTF-8 -> SHA-256 hex) --- */
async function hashPassword(password){
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

/* --- DOM --- */
const el = (id) => document.getElementById(id);

const regUser = el('reg-username');
const regPass = el('reg-password');
const btnRegister = el('btn-register');
const regMsg = el('reg-msg');

const loginUser = el('login-username');
const loginPass = el('login-password');
const btnLogin = el('btn-login');
const loginMsg = el('login-msg');

const usersList = el('users-list');
const recipientSelect = el('recipient');

const chatWith = el('chat-with');
const subtitle = el('subtitle');
const messagesEl = el('messages');
const chatWindow = el('chat-window');

const messageInput = el('message-input');
const btnSend = el('btn-send');
const btnLogout = el('btn-logout');
const currentUserInfo = el('currentUserInfo');

let currentUser = null;
let selectedPeer = null;

/* --- UI rendering --- */
function renderUsers(){
  const users = loadUsers();
  usersList.innerHTML = '';
  recipientSelect.innerHTML = '';
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = 'Select recipient...';
  recipientSelect.appendChild(placeholderOpt);

  users.forEach(u=>{
    const li = document.createElement('li');
    li.textContent = u.username;
    li.addEventListener('click', ()=> selectPeer(u.username));
    usersList.appendChild(li);

    const opt = document.createElement('option');
    opt.value = u.username;
    opt.textContent = u.username;
    recipientSelect.appendChild(opt);
  });
}

function setStatus(msgHtml){
  currentUserInfo.innerHTML = msgHtml;
}

function renderHeader(){
  if(!currentUser){
    chatWith.textContent = 'Not logged in';
    subtitle.textContent = 'Select a user to chat with.';
    setStatus('Not logged in');
    btnLogout.style.display = 'none';
  } else {
    btnLogout.style.display = 'inline-block';
    setStatus(`Logged in as <strong>${escapeHtml(currentUser.username)}</strong>`);
    if(selectedPeer){
      chatWith.textContent = `Chat with ${selectedPeer}`;
      subtitle.textContent = `Messages between you and ${selectedPeer}`;
    } else {
      chatWith.textContent = `Logged in: ${currentUser.username}`;
      subtitle.textContent = `Select a user (left) or choose recipient below.`;
    }
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

function renderMessages(){
  messagesEl.innerHTML = '';
  if(!currentUser || !selectedPeer){
    messagesEl.innerHTML = '<div class="meta" style="color:var(--muted)">No conversation selected.</div>';
    return;
  }
  const msgs = loadMessages()
    .filter(m => (m.from === currentUser.username && m.to === selectedPeer) || (m.from === selectedPeer && m.to === currentUser.username))
    .sort((a,b)=> new Date(a.ts) - new Date(b.ts));

  if(msgs.length === 0){
    messagesEl.innerHTML = `<div class="meta" style="color:var(--muted)">No messages between you and ${escapeHtml(selectedPeer)} yet.</div>`;
    return;
  }

  msgs.forEach(m=>{
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(m.from === currentUser.username ? 'me' : 'them');

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `${escapeHtml(m.from)} • ${fmtTime(m.ts)}`;
    div.appendChild(meta);

    const body = document.createElement('div');
    body.className = 'body';
    body.innerHTML = escapeHtml(m.text);
    div.appendChild(body);

    messagesEl.appendChild(div);
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function selectPeer(username){
  if(!currentUser){
    alert('Please login first.');
    return;
  }
  if(username === currentUser.username){
    alert("You can't chat with yourself (for this demo).");
    return;
  }
  selectedPeer = username;
  recipientSelect.value = username;
  renderHeader();
  renderMessages();
}

/* --- actions --- */
btnRegister.addEventListener('click', async ()=>{
  regMsg.textContent = '';
  const username = regUser.value.trim();
  const password = regPass.value;
  if(!username || !password){ regMsg.textContent = 'Enter username & password'; regMsg.className='msg error'; return; }

  const users = loadUsers();
  if(users.some(u=>u.username.toLowerCase() === username.toLowerCase())){
    regMsg.textContent = 'Username already exists';
    regMsg.className = 'msg error';
    return;
  }

  regMsg.textContent = 'Registering...';
  regMsg.className = 'msg';

  try {
    const hashed = await hashPassword(password);
    users.push({ username, passwordHash: hashed, createdAt: nowTs() });
    saveUsers(users);
    regMsg.textContent = 'Registered ✔';
    regMsg.className = 'msg success';
    regUser.value=''; regPass.value='';
    renderUsers();
  } catch(e){
    regMsg.textContent = 'Error registering';
    regMsg.className = 'msg error';
  }
});

btnLogin.addEventListener('click', async ()=>{
  loginMsg.textContent = '';
  const username = loginUser.value.trim();
  const password = loginPass.value;
  if(!username || !password){ loginMsg.textContent = 'Enter username & password'; loginMsg.className='msg error'; return; }

  const users = loadUsers();
  const user = users.find(u=>u.username.toLowerCase() === username.toLowerCase());
  if(!user){ loginMsg.textContent = 'User not found'; loginMsg.className='msg error'; return; }

  loginMsg.textContent = 'Checking...';
  loginMsg.className = 'msg';

  try {
    const hashed = await hashPassword(password);
    if(hashed !== user.passwordHash){
      loginMsg.textContent = 'Incorrect password';
      loginMsg.className = 'msg error';
      return;
    }

    currentUser = { username: user.username };
    saveCurrentUser(currentUser);        /* ---------------- ADDED ---------------- */

    loginMsg.textContent = 'Logged in ✔';
    loginMsg.className = 'msg success';
    loginUser.value=''; loginPass.value='';
    renderUsers();
    renderHeader();
    renderMessages();
  } catch(e){
    loginMsg.textContent = 'Login error';
    loginMsg.className = 'msg error';
  }
});

btnLogout.addEventListener('click', ()=>{
  saveCurrentUser(null);                  /* ---------------- ADDED ---------------- */
  currentUser = null;
  selectedPeer = null;
  renderHeader();
  renderMessages();
});

btnSend.addEventListener('click', ()=>{
  const to = recipientSelect.value;
  const text = messageInput.value.trim();
  if(!currentUser){ alert('Please login to send messages.'); return; }
  if(!to){ alert('Select a recipient.'); return; }
  if(to === currentUser.username){ alert("You can't send a message to yourself."); return; }
  if(!text) return;

  const users = loadUsers();
  if(!users.some(u=>u.username === to)){
    alert('Recipient does not exist.');
    return;
  }

  const msgs = loadMessages();
  msgs.push({ from: currentUser.username, to, text, ts: nowTs() });
  saveMessages(msgs);
  messageInput.value = '';

  if(selectedPeer === to) renderMessages();
  else {
    selectedPeer = to;
    renderHeader();
    renderMessages();
  }
});

messageInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    btnSend.click();
  }
});

recipientSelect.addEventListener('change', ()=>{
  const val = recipientSelect.value;
  if(val){
    selectPeer(val);
  } else {
    selectedPeer = null;
    renderHeader();
    renderMessages();
  }
});

/* ---------------- RESTORE USER ON REFRESH ---------------- */
currentUser = loadCurrentUser();          /* ---------------- ADDED ---------------- */

renderUsers();
renderHeader();
renderMessages();
