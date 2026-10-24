const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const DATA_FILE = path.join(__dirname, "data.json");
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, "../gradconnect-frontend");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const seed = {
  users: [
    { id: 1, name: "Philip Olawuyi", email: "philip@example.com", school: "SJCCC", year: 2026, bio: "Building meaningful connections with fellow alumni." },
    { id: 2, name: "Emmanuel Balogun", email: "emmanuel@example.com", school: "SJCCC", year: 2026, bio: "Interested in technology, business, and collaboration." },
    { id: 3, name: "Amaka Johnson", email: "amaka@example.com", school: "St. Mary's College", year: 2025, bio: "Creative professional and lifelong learner." },
    { id: 4, name: "Daniel Williams", email: "daniel@example.com", school: "SJCCC", year: 2024, bio: "Entrepreneur and community volunteer." }
  ],
  connections: [],
  posts: [
    { id: 1, userId: 2, content: "One may be sad alone, but it takes two or more to believe in what you can do best.", likes: [], comments: [], createdAt: new Date().toISOString() },
    { id: 2, userId: 3, content: "Throwback to graduation day. Grateful for every friendship made along the way.", likes: [], comments: [], createdAt: new Date().toISOString() }
  ],
  conversations: [],
  messages: [],
  events: [
    { id: 1, title: "Class of 2026 Reunion", date: "2026-12-12", location: "SJCCC Alumni Hall", description: "An evening of memories, music, and reconnecting with classmates.", attendees: [], createdBy: 1 },
    { id: 2, title: "Alumni Career Conversation", date: "2027-01-16", location: "Online", description: "A practical conversation about career growth and lifelong learning.", attendees: [], createdBy: 1 }
  ]
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return structuredClone(seed); }
}

let db = loadData();
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function nextId(items) { return items.length ? Math.max(...items.map(item => Number(item.id))) + 1 : 1; }
function currentUser(req) { return Number(req.header("x-user-id") || 1); }
function getUser(id) { return db.users.find(user => user.id === Number(id)); }
function getConnection(a, b) {
  return db.connections.find(connection =>
    (connection.userId === a && connection.targetUserId === b) ||
    (connection.userId === b && connection.targetUserId === a)
  );
}
function requireUser(req, res, next) {
  const user = getUser(currentUser(req));
  if (!user) return res.status(401).json({ error: "Unknown user" });
  req.user = user;
  next();
}
function publicUser(user) {
  if (!user) return null;
  const { email, ...safe } = user;
  return safe;
}
function conversationFor(userId, otherUserId) {
  return db.conversations.find(conversation =>
    (conversation.userOneId === userId && conversation.userTwoId === otherUserId) ||
    (conversation.userOneId === otherUserId && conversation.userTwoId === userId)
  );
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "gradconnect-backend" }));

app.post("/api/auth/demo", (req, res) => {
  const { name, email, school, year, bio } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });
  let user = db.users.find(item => item.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    user = { id: nextId(db.users), name, email, school: school || "", year: Number(year) || null, bio: bio || "" };
    db.users.push(user);
    save();
  }
  res.json({ user: publicUser(user), userId: user.id });
});

app.get("/api/me", requireUser, (req, res) => res.json(publicUser(req.user)));

app.get("/api/alumni", requireUser, (req, res) => {
  const query = String(req.query.q || "").toLowerCase();
  const users = db.users.filter(user => {
    if (!query) return true;
    return `${user.name} ${user.school} ${user.year}`.toLowerCase().includes(query);
  }).map(publicUser);
  res.json(users);
});

app.get("/api/alumni/:id", requireUser, (req, res) => {
  const user = getUser(req.params.id);
  if (!user) return res.status(404).json({ error: "Alumnus not found" });
  res.json(publicUser(user));
});

app.get("/api/connections", requireUser, (req, res) => {
  const userId = req.user.id;
  const result = db.connections
    .filter(connection => connection.userId === userId || connection.targetUserId === userId)
    .map(connection => ({ ...connection, user: publicUser(getUser(connection.userId === userId ? connection.targetUserId : connection.userId)) }));
  res.json(result);
});

app.post("/api/connections/:targetUserId", requireUser, (req, res) => {
  const targetUserId = Number(req.params.targetUserId);
  if (targetUserId === req.user.id) return res.status(400).json({ error: "You cannot connect with yourself" });
  if (!getUser(targetUserId)) return res.status(404).json({ error: "Alumnus not found" });
  const existing = getConnection(req.user.id, targetUserId);
  if (existing) return res.status(409).json({ error: existing.status === "accepted" ? "Already connected" : "Request already exists", connection: existing });
  const connection = { id: nextId(db.connections), userId: req.user.id, targetUserId, status: "pending", createdAt: new Date().toISOString() };
  db.connections.push(connection); save(); res.status(201).json(connection);
});

app.post("/api/connections/:requestId/accept", requireUser, (req, res) => {
  const connection = db.connections.find(item => item.id === Number(req.params.requestId) && item.targetUserId === req.user.id && item.status === "pending");
  if (!connection) return res.status(404).json({ error: "Pending request not found" });
  connection.status = "accepted"; connection.updatedAt = new Date().toISOString(); save(); res.json(connection);
});

app.get("/api/posts", requireUser, (_req, res) => {
  res.json([...db.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(post => ({
    ...post,
    likeCount: post.likes.length,
    commentCount: post.comments.length,
    likedByMe: post.likes.includes(currentUser(_req)),
    user: publicUser(getUser(post.userId))
  })));
});

app.post("/api/posts", requireUser, (req, res) => {
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "Post content is required" });
  const post = { id: nextId(db.posts), userId: req.user.id, content, likes: [], comments: [], createdAt: new Date().toISOString() };
  db.posts.push(post); save(); res.status(201).json(post);
});

app.post("/api/posts/:id/like", requireUser, (req, res) => {
  const post = db.posts.find(item => item.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });
  const index = post.likes.indexOf(req.user.id);
  if (index >= 0) post.likes.splice(index, 1); else post.likes.push(req.user.id);
  save(); res.json({ liked: index < 0, likeCount: post.likes.length });
});

app.post("/api/posts/:id/comments", requireUser, (req, res) => {
  const post = db.posts.find(item => item.id === Number(req.params.id));
  const content = String(req.body?.content || "").trim();
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!content) return res.status(400).json({ error: "Comment content is required" });
  const comment = { id: crypto.randomUUID(), userId: req.user.id, content, createdAt: new Date().toISOString() };
  post.comments.push(comment); save(); res.status(201).json(comment);
});

app.get("/api/conversations", requireUser, (req, res) => {
  const result = db.conversations.filter(conversation => conversation.userOneId === req.user.id || conversation.userTwoId === req.user.id).map(conversation => {
    const otherUserId = conversation.userOneId === req.user.id ? conversation.userTwoId : conversation.userOneId;
    const messages = db.messages.filter(message => message.conversationId === conversation.id);
    return { ...conversation, otherUser: publicUser(getUser(otherUserId)), lastMessage: messages[messages.length - 1] || null };
  });
  res.json(result);
});

app.get("/api/conversations/:otherUserId", requireUser, (req, res) => {
  const otherUserId = Number(req.params.otherUserId);
  const connection = getConnection(req.user.id, otherUserId);
  if (!connection || connection.status !== "accepted") return res.status(403).json({ error: "Connect with this alumnus before messaging" });
  const conversation = conversationFor(req.user.id, otherUserId);
  if (!conversation) return res.json({ conversation: null, otherUser: publicUser(getUser(otherUserId)), messages: [] });
  const messages = db.messages.filter(message => message.conversationId === conversation.id).map(message => ({ ...message, sender: publicUser(getUser(message.senderId)) }));
  res.json({ conversation, otherUser: publicUser(getUser(otherUserId)), messages });
});

app.post("/api/conversations/:otherUserId/messages", requireUser, (req, res) => {
  const otherUserId = Number(req.params.otherUserId);
  const content = String(req.body?.content || "").trim();
  const connection = getConnection(req.user.id, otherUserId);
  if (!connection || connection.status !== "accepted") return res.status(403).json({ error: "Connect with this alumnus before messaging" });
  if (!content || content.length > 5000) return res.status(400).json({ error: "Message must contain 1–5000 characters" });
  let conversation = conversationFor(req.user.id, otherUserId);
  if (!conversation) {
    conversation = { id: nextId(db.conversations), userOneId: Math.min(req.user.id, otherUserId), userTwoId: Math.max(req.user.id, otherUserId), createdAt: new Date().toISOString() };
    db.conversations.push(conversation);
  }
  const message = { id: nextId(db.messages), conversationId: conversation.id, senderId: req.user.id, content, createdAt: new Date().toISOString() };
  conversation.lastMessageAt = message.createdAt; db.messages.push(message); save(); res.status(201).json(message);
});

app.get("/api/events", requireUser, (_req, res) => res.json(db.events.map(event => ({ ...event, attendeeCount: event.attendees.length, attending: event.attendees.includes(currentUser(_req)) }))));
app.post("/api/events", requireUser, (req, res) => {
  const { title, date, location, description } = req.body || {};
  if (!title || !date || !location || !description) return res.status(400).json({ error: "title, date, location, and description are required" });
  const event = { id: nextId(db.events), title, date, location, description, attendees: [], createdBy: req.user.id };
  db.events.push(event); save(); res.status(201).json(event);
});
app.post("/api/events/:id/rsvp", requireUser, (req, res) => {
  const event = db.events.find(item => item.id === Number(req.params.id));
  if (!event) return res.status(404).json({ error: "Event not found" });
  const index = event.attendees.indexOf(req.user.id);
  if (index >= 0) event.attendees.splice(index, 1); else event.attendees.push(req.user.id);
  save(); res.json({ attending: index < 0, attendeeCount: event.attendees.length });
});

if (fs.existsSync(FRONTEND_DIR)) app.use(express.static(FRONTEND_DIR));
app.get("*", (_req, res) => {
  const index = path.join(FRONTEND_DIR, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).json({ error: "Frontend not found. Set FRONTEND_DIR or place index.html in gradconnect-frontend." });
});

app.listen(PORT, () => {
  console.log(`GradConnect backend running at http://localhost:${PORT}`);
  console.log(`Demo user: send the header x-user-id: 1 with API requests`);
});
