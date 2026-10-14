const firestore = require('../lib/firestore');

// Firestore gRPC status code for a malformed document id (e.g. "..").
const INVALID_ARGUMENT = 3;

async function findUser(userId) {
  // Ids containing '/' would address a different path, so they can never be a user.
  if (userId.includes('/')) return null;
  try {
    const user = await firestore.collection('users').doc(userId).get();
    return user.exists ? user : null;
  } catch (err) {
    if (err.code === INVALID_ARGUMENT) return null;
    throw err;
  }
}

// Identifies the caller from the X-User-Id header and checks the user exists.
// Placeholder until auth exists: the id will later come from a verified token.
async function requireUser(req, res, next) {
  const userId = req.get('X-User-Id')?.trim();
  if (!userId) {
    return res.status(401).json({ error: 'X-User-Id header is required' });
  }

  if (!(await findUser(userId))) {
    return res.status(403).json({ error: 'Unknown user' });
  }

  req.userId = userId;
  next();
}

module.exports = requireUser;
