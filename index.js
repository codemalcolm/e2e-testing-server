const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User.js");
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
  console.log(req.user)
  res.json({ message: "Welcome to the dashboard" });
});

app.get("/user-info", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
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
