const axios = require('axios');
axios.get('https://amzn.to/2YbkDkK').then(res => {
  console.log(res.request.res.responseUrl);
}).catch(console.error);
