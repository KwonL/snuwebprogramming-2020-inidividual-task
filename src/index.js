const express = require('express');
const mongoose = require('mongoose');
const { auth, JWT_SECRET } = require('./utils');
const { encryptPassword } = require('./utils');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User, Coin, Asset } = require('./models');
const CoinGecko = require('coingecko-api');

// Configuration
mongoose.connect(
  'mongodb+srv://kwonl:dbPassword@cluster0.n2dh5.mongodb.net/personal-project?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const CoinGeckoClient = new CoinGecko();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routers
app.get('/', auth, (req, res) => {
  res.send('Hello World');
});

app.post(
  '/register',
  [
    body('name').isLength({ min: 4, max: 12 }),
    body('email').isEmail().isLength({ max: 99 }),
    body('password').isLength({ min: 8, max: 16 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).send({ errors: { email: 'Already registered' } });
    }

    const encryptedPassword = encryptPassword(password);
    const user = new User({ email, name, password: encryptedPassword });
    await user.save();

    // Init Assets
    const coins = await Coin.find();
    coins.forEach((coin) => {
      const asset = new Asset({ user, coin, quantity: 0 });
      if (coin.code === 'usd') {
        asset.quantity = 3000;
      }
      asset.save();
    });

    return res.send({});
  }
);

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({
    email,
    password: encryptPassword(password),
  });

  if (!user) return res.sendStatus(403);

  const key = jwt.sign(
    {
      email: user.email,
    },
    JWT_SECRET
  );
  res.send({ key });
});

app.get('/coins', async (req, res) => {
  const coins = await Coin.find({ code: { $ne: 'usd' } });
  return res.send(coins.map((coin) => coin.code));
});

app.get('/assets', auth, async (req, res) => {
  const assets = await Asset.find({ user: req.user }).populate('coin');
  res.send(assets.map((asset) => ({ [asset.coin.code]: asset.quantity })));
});

app.get('/coins/:coin_name', async (req, res) => {
  const code = req.params.coin_name;
  const coin = await Coin.findOne({ code });
  if (!coin) {
    return res.status(404).send({ error: 'coin not found' });
  }
  const prices = await CoinGeckoClient.simple.price({
    ids: coin.name,
    vs_currencies: 'usd',
  });

  return res.send({ price: prices.data[coin.name].usd });
});

app.listen(3000, () => {
  console.log('Starting server on port 3000');
});
