const dbReady = require('../database/migrate');

let _db;
const getDb = async () => {
  if (!_db) _db = await dbReady;
  return _db;
};

module.exports = { getDb };
