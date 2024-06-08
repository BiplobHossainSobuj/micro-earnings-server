const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();
const port = process.env.port || 5000;
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRETE);
const jwt = require('jsonwebtoken');

// middleware 
app.use(cors())
app.use(express.json());

app.get('/', (req, res) => {
  res.send("mircro service is comming soooon");
})

app.listen(port, () => {
  console.log(`server is runing on port ${port}`);
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bswbr7l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//collections
const userCollection = client.db("micro-service").collection('users');
const taskCollection = client.db("micro-service").collection('tasks');
const submissionCollection = client.db("micro-service").collection('submissions');
const paymentCollection = client.db("micro-service").collection('payments');
const withdrawCollection = client.db("micro-service").collection('withdraws');
//verify admin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await userCollection.findOne({ email: email });
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).send({ massage: 'forbidden access' });
  }
  next();
}
//verify taskCreator
const verifyTaskCreator = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await userCollection.findOne({ email: email });
  const isTaskCreator = user?.role === 'taskCreator';
  if (!isTaskCreator) {
    return res.status(403).send({ massage: 'forbidden access' });
  }
  next();
}
//verify worker
const verifyWorker = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await userCollection.findOne({ email: email });
  const isWorker = user?.role === 'worker';
  if (!isWorker) {
    return res.status(403).send({ massage: 'forbidden access' });
  }
  next();
}
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    //collections
    // const userCollection = client.db("micro-service").collection('users');
    // const taskCollection = client.db("micro-service").collection('tasks');

    //token verify
    const verifyToken = (req, res, next) => {
      // console.log('inside verify middleware', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ massage: 'forbidden access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, 'secret', (err, decoded) => {
        if (err) {
          return res.status(401).send({ massage: 'forbidden access' });
        }
        req.decoded = decoded
        next();
      })
    }


    // jwt token 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      // console.log(user,'from jwt');
      const token = jwt.sign(user, 'secret', { expiresIn: '1h' })
      res.send({ token });
    })

    //users related api
    app.post('/users', async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    app.get('/users', async (req, res) => {
      const filter = { role: 'worker' };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    })
    //user delete
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
   
    
    // update user role 
    app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
      const role = req.body.userRole;
      // console.log(role);
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role
        }
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // admin check 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      // console.log(req.headers);
      const email = req.params.email;
      // console.log(email);
      if (email != req.decoded.email) {
        return res.status(403).send({ massage: 'unauthorized access from admin' });
      }
      const query = { email: email }
      const result = await userCollection.findOne(query);
      let admin = false;
      if (result) {
        admin = result?.role === 'admin'
      }
      // console.log(admin);
      res.send({ admin });
    })
    // task Creator check 
    app.get('/users/taskCreator/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email != req.decoded.email) {
        return res.status(403).send({ massage: 'unauthorized access from admin' });
      }
      const query = { email: email }
      const result = await userCollection.findOne(query);
      let taskCreator = false;
      if (result) {
        taskCreator = result?.role === 'taskCreator'
      }

      res.send({ taskCreator });
    })
    // worker check 
    app.get('/users/worker/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email != req.decoded.email) {
        return res.status(403).send({ massage: 'unauthorized access from admin' });
      }
      const query = { email: email }
      const result = await userCollection.findOne(query);
      let worker = false;
      if (result) {
        worker = result?.role === 'worker'
      }

      res.send({ worker });
    })

    //task creator relted api

    //add new task
    app.get('/tasks/:email', verifyToken, verifyTaskCreator, async (req, res) => {
      const email = req.params.email;
      const query = { creatorEmail: email };
      const result = await taskCollection.find(query).toArray();
      res.send(result);
    })
    //get task api for worker
    app.get('/tasks', verifyToken, verifyWorker, async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    })
    //get task details api for worker
    app.get('/tasks/:id', verifyToken, verifyWorker, async (req, res) => {
      const id = req.params.id;
      const query = {_id:new ObjectId(id)};
      const result = await taskCollection.findOne(query);
      res.send(result);
    })
    //worker task submission api 
    app.post('/submissions',verifyToken,verifyWorker,async(req,res)=>{
      const taskSubmissionInfo = req.body;
      const result = await submissionCollection.insertOne(taskSubmissionInfo);
      res.send(result);
    })
    app.get('/submissions/:email',verifyToken,verifyWorker,async(req,res)=>{
      const email = req.params.email;
      const query = {workerEmail:email};
      const result = await submissionCollection.find(query).toArray();
      res.send(result);
    })

    //creator added new task 
    app.post('/tasks', verifyToken, verifyTaskCreator, async (req, res) => {
      const taskInfo = req.body;
      const result = await taskCollection.insertOne(taskInfo);
      res.send(result);
    })
    //delete task
    app.delete('/tasks/:id', verifyToken, verifyTaskCreator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    })
    //update task
    app.patch('/tasks/:id', verifyToken, verifyTaskCreator, async (req, res) => {
      const updateInfo = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          taskTitle: updateInfo.taskTitle,
          taskDetails: updateInfo.taskDetails,
          submissionInfo: updateInfo.submissionDetails,
        }
      }
      const result = await taskCollection.updateOne(query, updatedDoc);
      // console.log(result);
      res.send(result);
    })
    //task creator review submitted task
    app.get('/submissions/taskCreator/:email',verifyToken,verifyTaskCreator,async(req,res)=>{
      const email = req.params.email;
      const query = {creatorEmail:email};
      const result = await submissionCollection.find(query).toArray();
      res.send(result);
    })
    //task creator view submission details of specific task
    app.get('/submissions/details/:id',verifyToken,verifyTaskCreator,async(req,res)=>{
      const id = req.params.id;
      const query = {_id:new ObjectId(id)};
      const result = await submissionCollection.find(query).toArray();
      res.send(result);
    })
    //approved submission task api
    app.patch('/submissions/approve/:id',verifyToken,verifyTaskCreator,async(req,res)=>{
      const id = req.params.id;
      const query = {_id:new ObjectId(id)};
      const updatedDoc = {
        $set:{status:'approved'}
      }
      const result = await submissionCollection.updateOne(query,updatedDoc);
      res.send(result);
    })
    //reject submission task api
    app.patch('/submissions/reject/:id',verifyToken,verifyTaskCreator,async(req,res)=>{
      const id = req.params.id;
      const query = {_id:new ObjectId(id)};
      const updatedDoc = {
        $set:{status:'rejected'}
      }
      const result = await submissionCollection.updateOne(query,updatedDoc);
      res.send(result);
    })

    // payments 
    //payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { amount } = req.body;
      const cost = parseInt(amount * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: cost,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send({paymentResult});
    })
    //withdraws 
    app.post('/withdraws', async (req, res) => {
      const withdraw = req.body;
      const withdrawResult = await withdrawCollection.insertOne(withdraw);
      res.send({withdrawResult});
    })
    app.get('/withdraws',verifyToken,verifyAdmin, async (req, res) => {
      const withdrawResult = await withdrawCollection.find().toArray();
      res.send(withdrawResult);
    })
    //delete withdraw after succesfull request
    app.delete('/withdraws/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id= req.params.id;
      const filter = {_id:new ObjectId(id)};
      const withdrawResult = await withdrawCollection.deleteOne(filter);
      res.send(withdrawResult);
    })
    app.patch('/users/:email',async(req,res)=>{
      const email = req.params.email;
      const query ={email:email};
      const user = await userCollection.findOne(query);
      const coinToBeDeducted = req.body.deductedCoin;
      const updatedDoc={
        $set:{
          coin:parseFloat(user.coin)-parseFloat(coinToBeDeducted)
        }
      }
      const result = await userCollection.updateOne(query,updatedDoc);
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
