const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const res = require("express/lib/response");

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clusterjackhammercorp.sucjv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const toolCollection = client.db("jackHammerCorp").collection("tools");
    const orderCollection = client.db("jackHammerCorp").collection("orders");

    // Getting All The tools from DB
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolCollection.find(query);
      const tools = await cursor.toArray();
      res.send(tools);
    });

    // Getting a single tool from db
    app.get("/purchase/:id", async (req, res) => {
      const toolId = req.params.id;
      const query = { _id: ObjectId(toolId) };
      const tool = await toolCollection.findOne(query);
      res.send(tool);
    });

    //Add a Order To DB
    app.post("/order", async (req, res) => {
      const orderDetails = req.body;
      const query = {
        name: orderDetails.name,
        email: orderDetails.email,
        productName: orderDetails.productName,
      };
      const exists = await orderCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, orderDetails: exists });
      }
      const result = await orderCollection.insertOne(orderDetails);
      return res.send({ success: true, result });
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
