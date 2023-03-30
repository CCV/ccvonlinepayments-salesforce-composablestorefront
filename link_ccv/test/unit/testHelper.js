const chai = require('chai');
const sinonChai = require('sinon-chai');
global.expect = chai.expect;
global.assert = chai.assert;
global.sinon = require('sinon');

chai.use(sinonChai);
