const mongoose = require('mongoose');

const User = mongoose.model('User', {
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const Coin = mongoose.model('Coin', {
  code: String,
  name: String,
  active: Boolean,
});

const Asset = mongoose.model('Asset', {
  user: { ref: 'User', type: mongoose.Schema.ObjectId },
  coin: { ref: 'Coin', type: mongoose.Schema.ObjectId },
  quantity: Number,
});

const Key = mongoose.model('Key', {
  user: { ref: 'User', type: mongoose.Schema.ObjectId },
  key: String,
});

module.exports = {
  User,
  Coin,
  Asset,
  Key,
};
