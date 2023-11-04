const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middle wire

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3fpwjd4.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


//middleware

const logger = async (req, res, next) => {
    console.log('called', req.host, req.originalUrl);
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'not authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        //err
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'unauthorized' })
        }
        // if token is valid then it would be decoded
        console.log('value in the token', decoded)
        req.decoded = decoded;
        next()

    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const serviceCollection = client.db('cardoctor').collection('services');
        const bookingCollection = client.db('cardoctor').collection('bookings')

        // auth related api

        // jwt.sign({
        //     data: 'foobar'
        // }, 'secret', { expiresIn: '1h' });

        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ status: true })

        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logged out', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })


        app.get('/services', logger, async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const options = {
                // Include only the `title` and `imdb` fields in each returned document
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };
            const result = await serviceCollection.findOne(query, options);
            res.send(result)
        })


        //bookings

        app.get('/bookings', logger, verifyToken, async (req, res) => {
            const email = req.query.email
            if (!email) {
                res.send([])
            }
            // check valid user
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                res.status(403).send({ message: 'Forbidden Access' })
            }
            const query = { email: email }
            const result = await bookingCollection.find().toArray();
            res.send(result)
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        })

        // update 

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateBooking = req.body;
            console.log(updateBooking);
            const updateDoc = {
                $set: {
                    status: updateBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc)
            console.log(result);
            res.send(result)

        })

        // delete method

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query)
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

app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`Car Doctor is running on port ${port}`);
})