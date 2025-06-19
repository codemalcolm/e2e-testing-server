const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User.js");
const Post = require("./models/Post.js");
const authenticateToken = require("./middleware/authenticateToken.js");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const connectDB = require("./db/connect.js");

const port = process.env.PORT || 5000;

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    throw new Error("No username or password provided");
  const hashed = await bcrypt.hash(password, 10);
  try {
    await User.create({ username, password: hashed });
    res.status(201).json({ message: "User created" });
  } catch {
    res.status(400).json({ error: "User already exists" });
  }
});

// Login
app.post("/login", async (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;
  if (!username || !password)
    throw new Error("No username or password provided");
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Protected Route
app.get("/dashboard", authenticateToken, (req, res) => {
  console.log(req.user);
  res.json({ message: "Welcome to the dashboard" });
});

app.get("/user-info", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.patch("/user-info", authenticateToken, async (req, res) => {
  const updates = {};
  if (req.body.username) updates.username = req.body.username;
  if (req.body.password)
    updates.password = await bcrypt.hash(req.body.password, 10);

  try {
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: "Update failed", details: e.message });
  }
});

// add post
app.post("/posts", authenticateToken, async (req, res) => {
  const { title, postText } = req.body;
  const { id: userId } = req.user;

  if (!title || !postText)
    return res.status(400).json({ error: "Missing field" });

  const post = await Post.create({
    title: title,
    postText: postText,
    authorId: userId,
  });
  res.json(post);
});

// posts of a single user
app.get("/user-info/posts", authenticateToken, async (req, res) => {
  const { id: userId } = req.user;

  try {
    const posts = await Post.find({
      authorId: userId,
    });

    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "You have no posts yet" });
    }
    res.json({ count: posts.length, posts: posts });
  } catch (error) {
    res.json(error);
  }
});

// posts from all users on homepage
app.get("/posts", async (req, res) => {
  try {
    const posts = (await Post.find().populate('authorId', '-password -__v'));

    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "There are no posts yet" });
    }
    res.json({ count: posts.length, posts: posts });
  } catch (error) {
    res.json(error);
  }
});

// editting post
app.patch("/posts/:taskId", authenticateToken, async (req, res) => {
  const { title, postText } = req.body;
  const { taskId } = req.params;

  if (!title || !postText)
    return res.status(400).json({ error: "Missing fields" });

  const post = await Post.findById(taskId);
  if (!post)
    return res
      .status(404)
      .json({ error: `Post with id: ${taskId} was not found` });

  if (post.authorId.toString() !== req.user.id.toString())
    return res
      .status(401)
      .json({ error: "Cannot edit posts that you don't own" });

  const edittedPost = await Post.findOneAndUpdate({ _id: taskId }, req.body, {
    new: true,
    runValidators: true,
  });

  res.json(edittedPost);
});

// deleting post
app.delete("/posts/:taskId", authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const post = await Post.findById(taskId);
  if (!post)
    return res
      .status(404)
      .json({ error: `Post with id: ${taskId} was not found` });

  if (post.authorId.toString() !== req.user.id.toString())
    return res
      .status(401)
      .json({ error: "Cannot delete posts that you don't own" });

  const deletedPost = await Post.findByIdAndDelete({ _id: taskId });

  res.json(deletedPost);
});

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("Mongo DB connected");
    app.listen(port, () =>
      console.log(`Server running on port http://localhost:${port}/`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
