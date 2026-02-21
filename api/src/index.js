require('dotenv').config();
const app  = require('./app');
const PORT = process.env.PORT || 8100;

app.listen(PORT, () => {
  console.log(`[cacheflow] API listening on port ${PORT}`);
});
