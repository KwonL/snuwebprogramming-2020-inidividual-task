const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('./models');

const JWT_SECRET = 'superdupersecretkey';

const encryptPassword = (password) =>
  crypto.createHash('sha512').update(password).digest('base64');

const auth = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) return res.sendStatus(401);
  const [bearer, token] = authorization.split(' ');
  if (bearer !== 'Bearer') return res.sendStatus(401);
  let email;
  try {
    email = jwt.verify(token, JWT_SECRET).email;
  } catch (e) {
    return res.sendStatus(401);
  }
  const user = await User.findOne({ email });
  if (!user) return res.sendStatus(401);
  req.user = user;
  next();
};

module.exports = {
  encryptPassword,
  auth,
  JWT_SECRET,
};
