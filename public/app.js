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
let announcedWinner = null;

const urlRoom = new URLSearchParams(location.search).get("room");
if (urlRoom) roomInput.value = urlRoom;

function setMode(m){
  mode = m;
  moveModeBtn.classList.toggle("active", m === "move");
  wallModeBtn.classList.toggle("active", m === "wall");
  boardEl.classList.toggle("wall-mode", m === "wall");
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

  addGoalMarkers();
  addWallSlots();
  addPawn(state.board.blue, "blue");
  addPawn(state.board.red, "red");
  state.board.walls.forEach(addWall);

  if(state.winner){
    announceWinner(state.winner);
    statusEl.textContent = "الفائز: " + (state.winner === "blue" ? "الأزرق" : "الأحمر");
  }else{
    announcedWinner = null;
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

function addGoalMarkers(){
  const redGoal = document.createElement("div");
  redGoal.className = "goal-line red-goal";
  const blueGoal = document.createElement("div");
  blueGoal.className = "goal-line blue-goal";
  boardEl.appendChild(redGoal);
  boardEl.appendChild(blueGoal);
}

function announceWinner(winner){
  if(announcedWinner === winner) return;
  announcedWinner = winner;
  alert("🏆 فوز " + label(winner));
}

function boardMetrics(){
  const rect = boardEl.getBoundingClientRect();
  const styles = getComputedStyle(boardEl);
  const padding = parseFloat(styles.paddingLeft) || 10;
  const gap = parseFloat(styles.gap) || 6;
  const cellSize = (rect.width - padding * 2 - gap * 8) / 9;
  return { padding, gap, cellSize };
}

function addWallSlots(){
  for(let y=0;y<9;y++){
    for(let x=0;x<8;x++){
      addWallSlot(x, y, x + 1, y, "vertical");
    }
  }

  for(let y=0;y<8;y++){
    for(let x=0;x<9;x++){
      addWallSlot(x, y, x, y + 1, "horizontal");
    }
  }
}

function addWallSlot(x1, y1, x2, y2, orientation){
  const { padding, gap, cellSize } = boardMetrics();
  const hit = Math.max(28, gap + 18);
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "wall-slot " + orientation;
  slot.setAttribute("aria-label", "إضافة حاجز");

  if(orientation === "vertical"){
    slot.style.left = (padding + (x1 + 1) * cellSize + x1 * gap + gap / 2 - hit / 2) + "px";
    slot.style.top = (padding + y1 * (cellSize + gap) - 4) + "px";
    slot.style.width = hit + "px";
    slot.style.height = (cellSize + 8) + "px";
  }else{
    slot.style.left = (padding + x1 * (cellSize + gap) - 4) + "px";
    slot.style.top = (padding + (y1 + 1) * cellSize + y1 * gap + gap / 2 - hit / 2) + "px";
    slot.style.width = (cellSize + 8) + "px";
    slot.style.height = hit + "px";
  }

  slot.onclick = event => {
    event.stopPropagation();
    placeWall(x1, y1, x2, y2);
  };

  boardEl.appendChild(slot);
}

function addWall(w){
  const { padding, gap, cellSize } = boardMetrics();
  const x = Math.min(w.x1,w.x2);
  const y = Math.min(w.y1,w.y2);
  const div = document.createElement("div");
  div.className = "wall " + w.color;

  if(w.y1 === w.y2){
    div.style.left = (padding + (x+1)*cellSize + x*gap + gap/2 - 4) + "px";
    div.style.top = (padding + y*(cellSize+gap)) + "px";
    div.style.width = "8px";
    div.style.height = cellSize + "px";
  }else{
    div.style.left = (padding + x*(cellSize+gap)) + "px";
    div.style.top = (padding + (y+1)*cellSize + y*gap + gap/2 - 4) + "px";
    div.style.width = cellSize + "px";
    div.style.height = "8px";
  }
  boardEl.appendChild(div);
}

function clickCell(x,y){
  if(!state || state.turn !== myColor) return;

  if(mode === "move"){
    socket.emit("move", { x, y });
  }
}

function placeWall(x1, y1, x2, y2){
  if(!state || state.turn !== myColor || mode !== "wall") return;
  socket.emit("wall", {
    x1,
    y1,
    x2,
    y2
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
