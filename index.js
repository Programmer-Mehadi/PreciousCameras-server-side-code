const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()


const app = express();
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.b6byypn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ status: 'unauthorized access' })
    }
    else {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN, function (e, decoded) {
            if (e) {
                return res.status(403).send({ status: 'Forbidden' })
            }
            req.decoded = decoded;
            next()
        })
    }
}

async function fun() {
    try {
        const userCollections = client.db('PreciousCameras').collection('users');
        const categoryCollections = client.db('PreciousCameras').collection('categories');
        const productCollections = client.db('PreciousCameras').collection('products');
        const bookingCollections = client.db('PreciousCameras').collection('bookings');
        const reportedCollections = client.db('PreciousCameras').collection('reportedItems');

        app.get('/', (req, res) => {
            res.send("PreciousCameras server running.");
        })
        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoryCollections.find(query).toArray();
            res.send(result);
        })
        app.get('/uservalidationcheck', verifyJWT, async (req, res) => {
            res.status(401).send({ status: 'Good' })
        })
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);

            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })

                return res.send({ accessToken: token })
            }
            else {
                res.status(403).send({ accessToken: 'No token' })
            }
        })
        //  add new users 
        app.post('/addusers', async (req, res) => {
            const user = req.body;
            user['isAdmin'] = false;
            user['verify'] = false;
            const query = { email: user.email }
            const foundUser = await userCollections.findOne(query);
            if (user.email !== foundUser?.email) {
                const result = await userCollections.insertOne(user);
                res.send(result);
            }
            else {
                res.send({ status: "Already inserted." })
            }
        })
        // admin , buyer , seller check
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            res.send({ isAdmin: user?.isAdmin === true });
        })
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            res.send({ isBuyer: user?.type === "Buyer" });
        })
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            res.send({ isSeller: user?.type === "Seller" });
        })
        //  get user info by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            res.send(user);
        })
        //  add product 
        app.post('/addproduct', verifyJWT, async (req, res) => {

            const product = req.body;
            const query = { email: req.decoded.email }
            const user = await userCollections.findOne(query);
            if (user) {
                if (user?.type === "Seller") {
                    const result = await productCollections.insertOne(product);

                    res.send(result);
                }
            }

        })
        //  get product 
        app.get('/myproducts/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            const query = { email: req.decoded.email }
            const user = await userCollections.findOne(query);
            if (user && email === decodedEmail) {
                if (user?.type === "Seller") {
                    const result = await productCollections.find(query).toArray();
                    res.send(result);
                }
            }

        })
        //  get product by id
        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category: id, salesStatus: "available" }
            let products = await productCollections.find(query).toArray();
            let allUsers = await userCollections.find({}).toArray();
            if (products.length === 0) {

                const query = { _id: ObjectId(id) };
                const result = await categoryCollections.findOne(query);
                res.send({ name: result?.name })
            }
            else {
                let newData = products.map(product => {
                    allUsers.map(user => {
                        if (user.email == product.email) {
                            product["userName"] = user.name;
                            product["verify"] = user?.verify;
                        }
                    })
                    return product;
                })
                res.send(newData);
            }

        })
        //  product delete 
        app.get('/deleteproduct/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;

            const query = {
                _id: ObjectId(id),
                email: req.decoded.email
            };
            const result = await productCollections.deleteOne(query);
            res.send(result)
        })
        //  make advertise 
        app.get('/makeadvertise/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id), email: req.decoded.email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: 'yes'
                }
            }
            const result = await productCollections.updateOne(filter, updatedDoc, options);
            res.send(result)
        })
        //  all buyers get
        app.get('/allbuyers/:email', verifyJWT, async (req, res) => {
            const email = req.decoded.email;
            const paramsEmail = req.params.email;
            if (email === paramsEmail) {
                const query = { type: "Buyer" };
                const result = await userCollections.find(query).toArray();
                res.send(result);
            }
        })
        app.get('/allsellers/:email', verifyJWT, async (req, res) => {
            const email = req.decoded.email;
            const paramsEmail = req.params.email;
            if (email === paramsEmail) {
                const query = { type: "Seller" };
                const result = await userCollections.find(query).toArray();
                res.send(result);
            }
        })
        // user type check 
        app.get('/checkusertype/:email', verifyJWT, async (req, res) => {
            const email = req.decoded.email;
            const paramsEmail = req.params.email;
            if (email === paramsEmail) {
                const query = { email: email };
                const result = await userCollections.findOne(query);

                res.send(result);
            }
        })
        //  get user orders
        app.get('/orders', verifyJWT, async (req, res) => {

            if (req.decoded.email === req.query.email) {
                const query = { customerEmail: req.decoded.email };
                const result = await bookingCollections.find(query).toArray();

                res.send(result);
            }
        })
        //  reort to admin
        app.post('/reporttoadmin/:id', verifyJWT, async (req, res) => {
            if (req.params.id === req.body.itemId) {
                const data = req.body;
                const query = { itemId: data.itemId, userEmail: data.userEmail };
                const found = await reportedCollections.findOne(query);

                if (!found) {
                    const result = await reportedCollections.insertOne(data);
                    res.send(result);
                }
                else {
                    res.send({ ownStatus: 'Already reported!' })
                }

            }
        })
        //  get all reported items 
        app.get('/reporteditems', verifyJWT, async (req, res) => {
            const query = {};
            const reportedItems = await reportedCollections.find(query).toArray();
            const products = await productCollections.find(query).toArray();
            let reportedProduct = []
            products.filter(product => {
                const myObjectId = product._id;
                id = myObjectId.toString()
                reportedItems.map(item => {
                    if (item.itemId == id) {

                        reportedProduct.push(product);
                    }
                })
            })
            res.send(reportedProduct);
        })
        //  delete user
        app.delete('/userdelete/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await userCollections.deleteOne(query);
            res.send(result)
        })
        //  reported products delete 
        app.delete('/reportedproductdelete/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollections.deleteOne(query);
            const removeBooking = await bookingCollections.deleteMany({ itemId: id });
            
            if (result.deletedCount > 0) {
                const query2 = { itemId: id }
                const deleteStatus = await reportedCollections.deleteOne(query2);
                res.send(deleteStatus)
            }
        })
        app.patch('/userverify/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    verify: true
                }
            }
            const result = await userCollections.updateOne(filter, updatedDoc, options);
            res.send(result)
        })
        //  add booking
        app.post('/addbooking', verifyJWT, async (req, res) => {
            const data = req.body;
            const query = { itemId: data.itemId, customerEmail: data.customerEmail };
            const found = await bookingCollections.findOne(query);
            if (!found) {
                const result = await bookingCollections.insertOne(data);
                res.send(result)
            }
            else {
                res.send({ ownStatus: 'You already booked it.' })
            }
            // console.log(data)


        })
    }
    finally {

    }
}
fun().catch(error => console.log(error))

app.listen(port, () => {
    console.log(`Running port : ${port}.`)
})