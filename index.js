// require('babel-register');
// const app = require('./server');
require('newrelic');
require('babel-core/register');
require('babel-polyfill');

require('./worker');