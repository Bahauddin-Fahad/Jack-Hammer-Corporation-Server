const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clusterjackhammercorp.sucjv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Can't Authorize the Access" });
  }
  const token = authHeader.split(" ")[1];
  // console.log(token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    await client.connect();
    const toolCollection = client.db("jackHammerCorp").collection("tools");
    const userCollection = client.db("jackHammerCorp").collection("users");
    const reviewCollection = client.db("jackHammerCorp").collection("reviews");
    const orderCollection = client.db("jackHammerCorp").collection("orders");
    const paymentCollection = client
      .db("jackHammerCorp")
      .collection("payments");

    //  Admin Verification
    const verifyAdmin = async (req, res, next) => {
      const userEmail = req.decoded.email;
      const user = await userCollection.findOne({
        email: userEmail,
      });
      if (user.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden access" });
      }
    };

    // Getting All The tools from DB
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolCollection.find(query);
      const tools = await cursor.toArray();
      res.send(tools);
    });

    // Add a new to Tool to DB
    app.post("/tool", verifyJWT, verifyAdmin, async (req, res) => {
      const tool = req.body;
      const result = await toolCollection.insertOne(tool);
      res.send(result);
    });

    // Updating Payment in Order Collection
    app.patch("/order/:id", verifyJWT, async (req, res) => {
      const orderId = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(orderId) };
      const updatedDoc = {
        $set: {
          paid: true,
          status: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updateOrder = await orderCollection.updateOne(filter, updatedDoc);

      res.send(updateOrder);
    });

    //Update Quantity Of Tool
    app.put("/tool/:id", async (req, res) => {
      const toolId = req.params.id;
      const newAvailableQuantity = req.body;
      const filter = { _id: ObjectId(toolId) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          availableQuantity: newAvailableQuantity.remaniningQuantity,
        },
      };
      const result = await toolCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //Deleting a Tool from DataBase
    app.delete("/tool/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const toolId = req.params.id;
      const query = { _id: ObjectId(toolId) };
      const result = await toolCollection.deleteOne(query);
      res.send(result);
    });

    // Getting a single tool from db
    app.get("/purchase/:id", async (req, res) => {
      const toolId = req.params.id;
      const query = { _id: ObjectId(toolId) };
      const tool = await toolCollection.findOne(query);
      res.send(tool);
    });

    app.get("/get/orders", async (req, res) => {
      const query = {};
      const cursor = orderCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    });
    // Get All the Orders
    app.get("/orders", verifyJWT, async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const cursor = orderCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    });

    //Getting an specific Order with Id
    app.get("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    //Add a Order To DB
    app.post("/order", async (req, res) => {
      const orderDetails = req.body;
      const query = {
        name: orderDetails.name,
        email: orderDetails.email,
        toolName: orderDetails.toolName,
      };
      const exists = await orderCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, orderDetails: exists });
      }
      const result = await orderCollection.insertOne(orderDetails);
      return res.send({ success: true, result });
    });

    //Shift the Order
    app.patch("/shift/order/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          shift: true,
        },
      };

      const updateShift = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updateShift);
    });

    //Cancel order by admin
    app.delete("/cancel/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });

    // Getting All the User
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    //Updating an specefic user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const accessToken = jwt.sign(filter, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ result, accessToken });
    });

    // Add an user as an Admin
    app.patch("/user/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Getting an Admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // get all reviews
    app.get("/reviews", async (req, res) => {
      const review = await reviewCollection.find({}).toArray();
      res.send(review);
    });
    // Getting The Reviews
    app.get("/review/:email", async (req, res) => {
      const email = req.params.email;
      const review = await reviewCollection.findOne({ email });
      res.send(review);
    });

    app.put("/review/:email", async (req, res) => {
      const email = req.params.email;
      const review = req.body;
      const query = {
        email: email,
      };
      const exists = await reviewCollection.findOne(query);
      if (exists) {
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            comment: review.comment,
            rating: review.rating,
          },
        };
        const result = await reviewCollection.updateOne(
          query,
          updatedDoc,
          options
        );
        return res.send({ update: true, result });
      }
      const result = await reviewCollection.insertOne(review);
      return res.send({ success: true, result });
    });

    // Adding payment Method
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const order = req.body;
      const totalPrice = order.totalPrice;
      const amount = totalPrice * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running Jack Hammer Corp Server");
});
app.listen(port, () => {
  console.log("Listening to the port");
});
