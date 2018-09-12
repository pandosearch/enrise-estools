'use strict';

const _ = require('lodash');

module.exports = sinon => {
  const stubs = {
    getAliasVersion: sinon.stub(),
    getIndexVersions: sinon.stub(),
    getMapping: sinon.stub(),
    createIndex: sinon.stub(),
    deleteIndex: sinon.stub(),
    updateAlias: sinon.stub(),
    prepareSynonymsMapping: sinon.stub()
  };

  return {
    ...stubs,
    _reset: () => _.forEach(stubs, stub => {
      stub.reset()
      stub.resetBehavior();
    })
  };
};