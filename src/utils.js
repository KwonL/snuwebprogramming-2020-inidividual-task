const crypto = require('crypto');
const { Key } = require('./models');

const JWT_SECRET = 'superdupersecretkey';

const encryptPassword = (password) =>
  crypto.createHash('sha512').update(password).digest('base64');

const auth = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) return res.sendStatus(401);
  const [bearer, token] = authorization.split(' ');
  if (bearer !== 'Bearer') return res.sendStatus(401);
  const key = await Key.findOne({ key: token });
  if (!key) return res.status(401).send({ error: { token: 'invalid token' } });
  const user = key.user;
  if (!user) return res.sendStatus(401);
  req.user = user;
  next();
};

module.exports = {
  encryptPassword,
  auth,
  JWT_SECRET,
};
