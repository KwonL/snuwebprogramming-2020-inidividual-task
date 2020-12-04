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
  const code = req.params['coin_name'];
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

const quantityValidator = body('quantity').customSanitizer((value) => {
  const validated = parseFloat(value);
  if (validated.toString().length > 6) {
    throw new Error('Quantity length is too big');
  }
  return validated;
});

app.post(
  '/coins/:coin_name/buy',
  [quantityValidator],
  auth,
  async (req, res) => {
    const code = req.params['coin_name'];
    const coin = await Coin.findOne({ code });
    if (!coin) {
      return res.status(404).send({ error: 'coin not found' });
    }
    const price = (
      await CoinGeckoClient.simple.price({
        ids: coin.name,
        vs_currencies: 'usd',
      })
    ).data[coin.name]['usd'];
    const quantity = req.body.quantity;
    const usdBalance = await Asset.findOne({
      user: req.user,
      coin: await Coin.findOne({ code: 'usd' }),
    });
    if (quantity * price > usdBalance.quantity) {
      return res
        .status(400)
        .send({ error: { quantity: 'not enough balance to buy' } });
    }
    const coinBalance = await Asset.findOne({
      user: req.user,
      coin: coin,
    });
    if (!coinBalance) {
      return res
        .status(400)
        .send({ error: { coin_name: 'Asset for that coin not found' } });
    }
    const buyPrice = parseFloat((quantity * price).toFixed(4));
    usdBalance.quantity -= buyPrice;
    await usdBalance.save();
    coinBalance.quantity += quantity;
    await coinBalance.save();

    return res.send({ price: buyPrice, quantity });
  }
);

app.post(
  '/coins/:coin_name/sell',
  [quantityValidator],
  auth,
  async (req, res) => {
    const code = req.params['coin_name'];
    const coin = await Coin.findOne({ code });
    if (!coin) {
      return res.status(404).send({ error: 'coin not found' });
    }
    const price = (
      await CoinGeckoClient.simple.price({
        ids: coin.name,
        vs_currencies: 'usd',
      })
    ).data[coin.name]['usd'];
    const quantity = req.body.quantity;
    const coinBalance = await Asset.findOne({
      user: req.user,
      coin: coin,
    });
    if (!coinBalance) {
      return res
        .status(400)
        .send({ error: { coin_name: 'Asset for that coin not found' } });
    }
    if (coinBalance.quantity < quantity) {
      return res
        .status(400)
        .send({ error: { quantity: 'Not enough quantity' } });
    }
    const usdBalance = await Asset.findOne({
      user: req.user,
      coin: await Coin.findOne({ code: 'usd' }),
    });
    const sellPrice = parseFloat((quantity * price).toFixed(4));
    usdBalance.quantity += sellPrice;
    await usdBalance.save();
    coinBalance.quantity -= quantity;
    await coinBalance.save();

    return res.send({ price: sellPrice, quantity: quantity });
  }
);

app.post('/coins/:coin_name/buy-all', auth, async (req, res) => {
  const code = req.params['coin_name'];
  const coin = await Coin.findOne({ code });
  if (!coin) {
    return res.status(404).send({ error: 'coin not found' });
  }
  const price = (
    await CoinGeckoClient.simple.price({
      ids: coin.name,
      vs_currencies: 'usd',
    })
  ).data[coin.name]['usd'];
  const usdBalance = await Asset.findOne({
    user: req.user,
    coin: await Coin.findOne({ code: 'usd' }),
  });
  const coinBalance = await Asset.findOne({
    user: req.user,
    coin: coin,
  });
  if (!coinBalance) {
    return res
      .status(400)
      .send({ error: { coin_name: 'Asset for that coin not found' } });
  }
  const prevBalance = usdBalance.quantity;
  const buyQuantity = usdBalance.quantity / price;
  usdBalance.quantity = 0;
  await usdBalance.save();
  coinBalance.quantity += buyQuantity;
  await coinBalance.save();

  return res.send({ price: prevBalance, quantity: buyQuantity });
});

app.post('/coins/:coin_name/sell-all', auth, async (req, res) => {
  const code = req.params['coin_name'];
  const coin = await Coin.findOne({ code });
  if (!coin) {
    return res.status(404).send({ error: 'coin not found' });
  }
  const price = (
    await CoinGeckoClient.simple.price({
      ids: coin.name,
      vs_currencies: 'usd',
    })
  ).data[coin.name]['usd'];
  const usdBalance = await Asset.findOne({
    user: req.user,
    coin: await Coin.findOne({ code: 'usd' }),
  });
  const coinBalance = await Asset.findOne({
    user: req.user,
    coin: coin,
  });
  if (!coinBalance) {
    return res
      .status(400)
      .send({ error: { coin_name: 'Asset for that coin not found' } });
  }
  const sellQuantity = coinBalance.quantity * price;
  const prevQuantity = coinBalance.quantity;
  usdBalance.quantity += sellQuantity;
  await usdBalance.save();
  coinBalance.quantity = 0;
  await coinBalance.save();

  return res.send({ price: sellQuantity, quantity: prevQuantity });
});

app.listen(3000, () => {
  console.log('Starting server on port 3000');
});
