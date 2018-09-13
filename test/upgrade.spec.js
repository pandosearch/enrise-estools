'use strict';

/* global describe, beforeEach, it */
/* eslint-disable camelcase */

const _ = require('lodash');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const chai = require('chai');
chai.use(require('sinon-chai'));

const mochaAsync = fn => done => {
  fn()
    .then(() => done())
    .catch(done);
};

describe('upgrade', () => {
  const helpers = require('./helpers.stubs')(sinon);
  const {
    getAliasVersion,
    getIndexVersions,
    getMapping,
    createIndex,
    deleteIndex,
    updateAlias,
    prepareSynonymsMapping
  } = helpers;
  const esClient = {};
  const synonyms = {};

  const upgrade = proxyquire('../src/upgrade', {
    './helpers': helpers
  });

  const mapping = {
    settings: {},
    mappings: {}
  };

  const filter = {
    synonyms: {synonyms: ['some,synonyms']},
    pre_synonyms: {synonyms: ['pre_some,pre_synonyms']}
  };

  beforeEach(() => helpers._reset());

  it('is a function', () => {
    chai.expect(upgrade).to.be.a('Function');
  });

  // it('throws an error if getAliasVersion could not find an alias version', mochaAsync(async () => {
  it('throws an error if currentVersion is not provided, it cannot be found from feeder- alias and no mapping was ' +
    'provided', mochaAsync(async () => {
    const options = {
      targetVersion: 4
    };

    getAliasVersion.resolves(null);

    try {
      await upgrade(esClient, 'enrise.nl-nl', options);
      throw new Error('expected upgrade to fail with an error');
    } catch (err) {
      chai.expect(err).to.be.an.instanceof(Error);
      chai.expect(err.message).to.equal('Mapping must be provided, if there is no existing feeder- alias to ' +
        'retrieve the mapping from.');
    }
  }));

  it('throws an error if no mapping was found', mochaAsync(async () => {
    const options = {
      currentVersion: 3,
      targetVersion: 4,
      mapping: null
    };

    getMapping.resolves(null);

    try {
      await upgrade(esClient, 'enrise.nl-nl', options);
      throw new Error('expected upgrade to fail with an error');
    } catch (err) {
      chai.expect(err).to.be.an.instanceof(Error);
      chai.expect(err.message).to.equal('No mapping found.');
    }
  }));

  it('calls all functions with the correct parameters', mochaAsync(async () => {
    const options = {
      currentVersion: 3,
      targetVersion: 4,
      mapping,
      synonyms
    };

    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getAliasVersion).to.have.not.been.called;
    chai.expect(getIndexVersions).to.have.not.been.called;
    chai.expect(getMapping).to.have.not.been.called;
    chai.expect(prepareSynonymsMapping).to.have.been.calledWith(mapping, synonyms);
    chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
    chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
      'enrise.nl-nl-v3', 'enrise.nl-nl-v4');
  }));

  it('calls all functions and defaults targetVersion to 1 if it was not provided, and not deviated from the indices',
    mochaAsync(async () => {
      const options = {
        mapping
      };

      getAliasVersion.resolves(null);
      getIndexVersions.resolves([]);

      await upgrade(esClient, 'enrise.nl-nl', options);
      chai.expect(getAliasVersion).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl');
      chai.expect(getIndexVersions).to.have.calledWith(esClient, 'enrise.nl-nl');
      chai.expect(getMapping).to.have.not.been.called;
      chai.expect(prepareSynonymsMapping).to.not.have.been.called;
      chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v1', mapping);
      chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
        null, 'enrise.nl-nl-v1');
    }));

  it('always uses the latest index version, not the version of the feeder for the next index', mochaAsync(async () => {
    const options = {
      currentVersion: 1,
      synonyms
    };

    getIndexVersions.resolves([3, 2, 1]);
    getMapping.resolves(mapping);

    await upgrade(esClient, 'enrise.nl-nl', options);

    chai.expect(getAliasVersion).to.have.not.been.called;
    chai.expect(getIndexVersions).to.have.calledWith(esClient, 'enrise.nl-nl');
    // should use feeder index to determine the mapping
    chai.expect(getMapping).to.have.been.calledWith(esClient, 'enrise.nl-nl-v1');
    chai.expect(prepareSynonymsMapping).to.have.been.calledWith(mapping, synonyms);
    chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
    chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
      'enrise.nl-nl-v1', 'enrise.nl-nl-v4');
  }));

  it('reverts the index, if updating the alias fails', mochaAsync(async () => {
    const options = {
      currentVersion: 3,
      targetVersion: 4,
      mapping,
      synonyms
    };

    updateAlias.rejects('failed');

    try {
      await upgrade(esClient, 'enrise.nl-nl', options);
      throw new Error('expected upgrade to fail with an error');
    } catch (err) {
      chai.expect(getAliasVersion).to.have.not.been.called;
      chai.expect(getIndexVersions).to.have.not.been.called;
      chai.expect(getMapping).to.have.not.been.called;
      chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
      chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
        'enrise.nl-nl-v3', 'enrise.nl-nl-v4');
      chai.expect(deleteIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4');
    }
  }));

  it('retrieves the current feeder- version if currentVersion was not provided', mochaAsync(async () => {
    const options = {
      targetVersion: 4,
      mapping,
      synonyms
    };

    getAliasVersion.resolves(3);
    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getAliasVersion).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl');
    chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
      'enrise.nl-nl-v3', 'enrise.nl-nl-v4');
  }));
  it('retrieves the new feeder- version if targetVersion was not provided', mochaAsync(async () => {
    const options = {
      currentVersion: 3,
      mapping,
      synonyms
    };

    getIndexVersions.resolves([5, 2, 1]);
    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getIndexVersions).to.have.been.calledWith(esClient, 'enrise.nl-nl');
    chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
      'enrise.nl-nl-v3', 'enrise.nl-nl-v6');
  }));
  it('retrieves the mapping from the current feeder- version if mapping was not provided', mochaAsync(async () => {
    const otherMapping = {};
    const options = {
      currentVersion: 3,
      targetVersion: 4,
      synonyms
    };

    getMapping.resolves(otherMapping);
    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getMapping).to.have.been.calledWith(esClient, 'enrise.nl-nl-v3');
    chai.expect(createIndex).to.not.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
    chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', otherMapping);
  }));

  it('retrieves the existing synonyms if no synonyms are provided, useExistingSynonyms is true ' +
    'and the current feeder- version is higher than 1', mochaAsync(async () => {
    const otherMapping = _.set({}, 'settings.index.analysis.filter', filter);

    const options = {
      currentVersion: 3,
      targetVersion: 4,
      useExistingSynonyms: true
    };

    getMapping.onCall(0).resolves(mapping);
    getMapping.onCall(1).resolves(otherMapping);

    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getAliasVersion).to.have.not.been.called;
    chai.expect(getIndexVersions).to.have.not.been.called;
    chai.expect(getMapping).to.have.been.calledTwice;
    chai.expect(prepareSynonymsMapping).to.have.been.calledOnce;
    chai.expect(prepareSynonymsMapping.getCall(0).args).to.deep.equal([mapping, {
      synonyms: ['some,synonyms'],
      preSynonyms: ['pre_some,pre_synonyms']
    }]);
    chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
    chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
      'enrise.nl-nl-v3', 'enrise.nl-nl-v4');
  }));

  it('does not retrieve the existing synonyms if synonyms are provided, useExistingSynonyms is true ' +
    'and the current feeder- version is higher than 1', mochaAsync(async () => {
    const options = {
      currentVersion: 3,
      targetVersion: 4,
      useExistingSynonyms: true,
      mapping,
      synonyms
    };

    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getMapping).to.not.have.been.called;
  }));

  it('does not retrieve the existing synonyms if currentVersion does not yet exist', mochaAsync(async () => {
    const options = {
      useExistingSynonyms: true,
      mapping
    };

    getAliasVersion.resolves(null);
    getIndexVersions.resolves([]);

    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getMapping).to.not.have.been.called;
    chai.expect(prepareSynonymsMapping).to.not.have.been.called;
  }));

  it('it does not apply the synonyms onto the mapping if synonyms are not provided', mochaAsync(async () => {
    const options = {
      currentVersion: 3,
      targetVersion: 4,
      mapping
    };

    await upgrade(esClient, 'enrise.nl-nl', options);
    chai.expect(getMapping).to.have.not.been.called;
    chai.expect(prepareSynonymsMapping).to.not.have.been.called;
    chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
    chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
      'enrise.nl-nl-v3', 'enrise.nl-nl-v4');
  }));

  it('it does not apply the synonyms onto the mapping if synonyms are not retrieved from the index',
    mochaAsync(async () => {
      const options = {
        currentVersion: 3,
        targetVersion: 4,
        mapping,
        useExistingSynonyms: true
      };

      getMapping.resolves({});
      await upgrade(esClient, 'enrise.nl-nl', options);
      chai.expect(getMapping).to.have.been.calledOnce;
      chai.expect(prepareSynonymsMapping).to.not.have.been.called;
      chai.expect(createIndex).to.have.been.calledWith(esClient, 'enrise.nl-nl-v4', mapping);
      chai.expect(updateAlias).to.have.been.calledWith(esClient, 'feeder-enrise.nl-nl',
        'enrise.nl-nl-v3', 'enrise.nl-nl-v4');
    }));
});
