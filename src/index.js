const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { auth } = require('./utils');
const { encryptPassword } = require('./utils');
const { body, validationResult } = require('express-validator');

const { User } = require('./models');

// Configuration
mongoose.connect(
  'mongodb+srv://kwonl:dbPassword@cluster0.n2dh5.mongodb.net/personal-project?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', auth, (req, res) => {
  res.send('Hello World!22');
});

app.post(
  '/signup',
  [
    body('name').isLength({ min: 3, max: 20 }),
    body('email').isEmail(),
    body('password').isLength({ min: 10, max: 20 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ errors: { email: 'Already registered' } });
    }

    const encryptedPassword = encryptPassword(password);
    const user = new User({ email, name, password: encryptedPassword });
    await user.save();

    return res.sendStatus(200);
  }
);

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({
    email,
    password: encryptPassword(password),
  });

  if (!user) return res.sendStatus(403);

  const key = crypto.randomBytes(24).toString('hex');
  user.key = key;
  await user.save();
  res.send({ key });
});
