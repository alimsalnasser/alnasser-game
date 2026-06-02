const socket = io();
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("joinBtn");
const shareBtn = document.getElementById("shareBtn");
const restartBtn = document.getElementById("restartBtn");
const moveModeBtn = document.getElementById("moveMode");
const wallModeBtn = document.getElementById("wallMode");

let myColor = null;
let state = null;
let mode = "move";
let selectedWallStart = null;

const urlRoom = new URLSearchParams(location.search).get("room");
if (urlRoom) roomInput.value = urlRoom;

function setMode(m){
  mode = m;
  selectedWallStart = null;
  moveModeBtn.classList.toggle("active", m === "move");
  wallModeBtn.classList.toggle("active", m === "wall");
}
moveModeBtn.onclick = () => setMode("move");
wallModeBtn.onclick = () => setMode("wall");

joinBtn.onclick = () => {
  const roomId = roomInput.value.trim() || "demo";
  history.replaceState(null, "", "?room=" + encodeURIComponent(roomId));
  socket.emit("join", { roomId, name: "player" });
};

shareBtn.onclick = async () => {
  const roomId = roomInput.value.trim() || "demo";
  const link = location.origin + "?room=" + encodeURIComponent(roomId);
  if (navigator.share) await navigator.share({ title:"لعبة الحواجز", url:link });
  else {
    await navigator.clipboard.writeText(link);
    alert("تم نسخ رابط الغرفة");
  }
};

restartBtn.onclick = () => socket.emit("restart");

socket.on("joined", data => {
  myColor = data.color;
  statusEl.textContent = myColor === "spectator" ? "مشاهد" : "أنت اللاعب: " + (myColor === "blue" ? "الأزرق" : "الأحمر");
});

socket.on("state", s => {
  state = s;
  render();
});

function render(){
  boardEl.innerHTML = "";
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.onclick = () => clickCell(x,y);
      boardEl.appendChild(cell);
    }
  }

  if(!state) return;

  addPawn(state.board.blue, "blue");
  addPawn(state.board.red, "red");
  state.board.walls.forEach(addWall);

  if(state.winner){
    statusEl.textContent = "الفائز: " + (state.winner === "blue" ? "الأزرق" : "الأحمر");
  }else{
    statusEl.textContent = "دور: " + (state.turn === "blue" ? "الأزرق" : "الأحمر") + " | أنت: " + label(myColor);
  }
}

function label(c){
  if(c === "blue") return "الأزرق";
  if(c === "red") return "الأحمر";
  return "مشاهد";
}

function addPawn(p, color){
  const cell = [...document.querySelectorAll(".cell")].find(c => +c.dataset.x === p.x && +c.dataset.y === p.y);
  if(!cell) return;
  const pawn = document.createElement("div");
  pawn.className = "pawn " + color;
  cell.appendChild(pawn);
}

function addWall(w){
  const rect = boardEl.getBoundingClientRect();
  const cellSize = (rect.width - 20 - 8*6) / 9;
  const gap = 6;
  const x = Math.min(w.x1,w.x2);
  const y = Math.min(w.y1,w.y2);
  const div = document.createElement("div");
  div.className = "wall " + w.color;

  if(w.y1 === w.y2){
    div.style.left = (10 + (x+1)*cellSize + x*gap + gap/2 - 4) + "px";
    div.style.top = (10 + y*(cellSize+gap)) + "px";
    div.style.width = "8px";
    div.style.height = cellSize + "px";
  }else{
    div.style.left = (10 + x*(cellSize+gap)) + "px";
    div.style.top = (10 + (y+1)*cellSize + y*gap + gap/2 - 4) + "px";
    div.style.width = cellSize + "px";
    div.style.height = "8px";
  }
  boardEl.appendChild(div);
}

function clickCell(x,y){
  if(!state || state.turn !== myColor) return;

  if(mode === "move"){
    socket.emit("move", { x, y });
    return;
  }

  if(!selectedWallStart){
    selectedWallStart = { x, y };
    return;
  }

  socket.emit("wall", {
    x1:selectedWallStart.x,
    y1:selectedWallStart.y,
    x2:x,
    y2:y
  });
  selectedWallStart = null;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
