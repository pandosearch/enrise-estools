'use strict';

const _ = require('lodash');

module.exports = sinon => {
  const indicesStubs = {
    getAlias: sinon.stub(),
    stats: sinon.stub(),
    get: sinon.stub(),
    create: sinon.stub(),
    delete: sinon.stub(),
    updateAliases: sinon.stub(),
  };

  return {
    indices: indicesStubs,
    _reset: () => _.forEach(indicesStubs, stub => {
      stub.reset();
      stub.resetBehavior();
    })
  };
};
