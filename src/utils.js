const crypto = require('crypto');

const encryptPassword = (password) =>
  crypto.createHash('sha512').update(password).digest('base64');

const auth = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) return res.sendStatus(401);
  const [bearer, key] = authorization.split(' ');
  if (bearer !== 'Bearer') return res.sendStatus(401);
  const user = await User.findOne({ key });
  if (!user) return res.sendStatus(401);
  req.user = user;
  next();
};

module.exports = {
  encryptPassword,
  auth
};
