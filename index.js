const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 9999;

// doctorsportal-showvro-firebase-adminsdk.json

const serviceAccount = require("./doctorsportal-showvro-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//Middlewire
app.use(cors());
app.use(express.json());

//Installing Database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rzdhw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
}

//Connect to MongoDB
async function run() {
  try {
    await client.connect();

    //db config
    const database = client.db("doctor_portal");
    const appoinmentCollection = database.collection("appoinment");
    const usersCollection = database.collection("users");

    //find
    app.get("/appoinments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const query = { email: email, date: date };
      const cursor = appoinmentCollection.find(query);
      const appoinments = await cursor.toArray();
      res.json(appoinments);
    });

    //get
    app.post("/appoinments", async (req, res) => {
      const appoinment = req.body;
      const result = await appoinmentCollection.insertOne(appoinment);
      // console.log(result);
      res.json(result);
    });

    //user info
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      // console.log(result)
      res.json(result);
    });

    //update
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateUser = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateUser,
        options
      );
      res.json(result);
    });

    //make admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      // req.headers.authorization;
      const requster = req.decodedEmail;
      if (requster) {
        const requsterAccount = await usersCollection.findOne({
          email: requster,
        });
        if (requsterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateUser = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateUser);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "You do not have access to make admin" });
      }
    });
  } finally {
    // await client.close();
  }
}
//calling the functions
run().catch(console.dir);

//Default Express.js Functions
app.get("/", (req, res) => {
  res.send("Backend is Running");
});

app.listen(port, () => {
  console.log("Running PORT", port);
});
