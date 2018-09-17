'use strict';

/* global describe, beforeEach, it */
/* eslint-disable camelcase */

const _ = require('lodash');
const sinon = require('sinon');
const chai = require('chai');
chai.use(require('sinon-chai'));

const mochaAsync = fn => done => {
  fn()
    .then(() => done())
    .catch(done);
};

describe('helpers', () => {

  const esClient = require('./esclient.stubs')(sinon);
  const helpers = require('../src/helpers');

  beforeEach(() => esClient._reset());

  describe('getAliasVersion', () => {
    it('throws an error if multiple aliases are reseived', mochaAsync(async () => {
      esClient.indices.getAlias.resolves({
        'enrise.nl-nl-v1': {},
        'enrise.nl-nl-v2': {}
      });

      try {
        await helpers.getAliasVersion(esClient, 'feeder-enrise.nl-nl');
        throw new Error('expected getAlias to fail with an error');
      } catch (err) {
        chai.expect(esClient.indices.getAlias).to.be.calledWith({name: 'feeder-enrise.nl-nl'});
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Multiple aliases recieved');
      }
    }));
    it('throws an error if getAlias fails', mochaAsync(async () => {
      esClient.indices.getAlias.rejects(new Error('Failed'));

      try {
        await helpers.getAliasVersion(esClient, 'feeder-enrise.nl-nl');
        throw new Error('expected getAlias to fail with an error');
      } catch (err) {
        chai.expect(esClient.indices.getAlias).to.be.calledWith({name: 'feeder-enrise.nl-nl'});
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Failed');
      }
    }));
    it('correctly returns the alias version', mochaAsync(async () => {
      esClient.indices.getAlias.resolves({
        'enrise.nl-nl-v2': {}
      });

      const result = await helpers.getAliasVersion(esClient, 'feeder-enrise.nl-nl');

      chai.expect(esClient.indices.getAlias).to.be.calledWith({name: 'feeder-enrise.nl-nl'});
      chai.expect(result).to.equal(2);
    }));
    it('returns null if the version cannot be parsed from the index name', mochaAsync(async () => {
      esClient.indices.getAlias.resolves({
        'enrise.nl-nl-v1sd': {}
      });

      const result = await helpers.getAliasVersion(esClient, 'feeder-enrise.nl-nl');

      chai.expect(esClient.indices.getAlias).to.be.calledWith({name: 'feeder-enrise.nl-nl'});
      chai.expect(result).to.equal(null);
    }));
    it('returns null if no alias was found', mochaAsync(async () => {
      esClient.indices.getAlias.rejects({
        statusCode: 404
      });

      const result = await helpers.getAliasVersion(esClient, 'feeder-enrise.nl-nl');

      chai.expect(esClient.indices.getAlias).to.be.calledWith({name: 'feeder-enrise.nl-nl'});
      chai.expect(result).to.equal(null);
    }));
  });

  describe('getIndexVersions', () => {
    it('throws an error if getIndexVersions fails', mochaAsync(async () => {
      esClient.indices.stats.rejects(new Error('Failed'));

      try {
        await helpers.getIndexVersions(esClient, 'enrise.nl-nl');
        throw new Error('expected getIndexVersions to fail with an error');
      } catch (err) {
        chai.expect(esClient.indices.stats).to.be.calledWith({
          index: 'enrise.nl-nl-v*',
          metric: 'indices'
        });
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Failed');
      }
    }));

    it('returns a sorted list of all versions that match this index', mochaAsync(async () => {
      esClient.indices.stats.resolves({
        indices: {
          'enrise.nl-nl-v4': {},
          'enrise.nl-nl-v2': {},
          'enrise.nl-nl-v6': {},
          'enrise.nl-nl-v8a': {},
          'enrise.nl-nl-vf5': {},
          'enrise.nl-nl-v3': {}
        }
      });

      const result = await helpers.getIndexVersions(esClient, 'enrise.nl-nl');

      chai.expect(esClient.indices.stats).to.be.calledWith({
        index: 'enrise.nl-nl-v*',
        metric: 'indices'
      });
      chai.expect(result).to.deep.equal([6, 4, 3, 2]);
    }));
  });

  describe('getMapping', () => {
    it('throws an error if indices.get fails', mochaAsync(async () => {
      esClient.indices.get.rejects(new Error('Failed'));

      try {
        await helpers.getMapping(esClient, 'enrise.nl-nl-v2');
        throw new Error('expected getMapping to fail with an error');
      } catch (err) {
        chai.expect(esClient.indices.get).to.be.calledWith({index: 'enrise.nl-nl-v2'});
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Failed');
      }
    }));

    it('retrieves the settings mapping from an index', mochaAsync(async () => {
      esClient.indices.get.resolves({
        'enrise.nl-nl-v2': {
          settings: {the: 'settings'},
          mappings: {the: 'mappings'},
          aliases: {the: 'aliases'},
          warmers: true
        }
      });

      const result = await helpers.getMapping(esClient, 'enrise.nl-nl-v2');

      chai.expect(esClient.indices.get).to.be.calledWith({index: 'enrise.nl-nl-v2'});
      chai.expect(result).to.deep.equal({
        settings: {the: 'settings'},
        mappings: {the: 'mappings'}
      });
    }));
  });

  describe('createIndex', () => {
    const mapping = {the: 'mapping'};

    it('throws an error if indices.create fails', mochaAsync(async () => {
      esClient.indices.create.rejects(new Error('Failed'));

      try {
        await helpers.createIndex(esClient, 'enrise.nl-nl-v2', mapping);
        throw new Error('expected createIndex to fail with an error');
      } catch (err) {
        chai.expect(esClient.indices.create).to.be.calledWith({
          index: 'enrise.nl-nl-v2',
          body: mapping
        });
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Failed');
      }
    }));

    it('creates a new index', mochaAsync(async () => {
      esClient.indices.create.resolves({success: true});

      const result = await helpers.createIndex(esClient, 'enrise.nl-nl-v2', mapping);

      chai.expect(esClient.indices.create).to.be.calledWith({
        index: 'enrise.nl-nl-v2',
        body: mapping
      });
      chai.expect(result).to.deep.equal({success: true});
    }));
  });

  describe('deleteIndex', () => {
    it('throws an error if indices.delete fails', mochaAsync(async () => {
      esClient.indices.delete.rejects(new Error('Failed'));

      try {
        await helpers.deleteIndex(esClient, 'enrise.nl-nl-v2');
        throw new Error('expected deleteIndex to fail with an error');
      } catch (err) {
        chai.expect(esClient.indices.delete).to.be.calledWith({
          index: 'enrise.nl-nl-v2'
        });
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Failed');
      }
    }));

    it('deletes an index', mochaAsync(async () => {
      esClient.indices.delete.resolves({success: true});

      const result = await helpers.deleteIndex(esClient, 'enrise.nl-nl-v2');

      chai.expect(esClient.indices.delete).to.be.calledWith({
        index: 'enrise.nl-nl-v2'
      });
      chai.expect(result).to.deep.equal({success: true});
    }));
  });

  describe('updateAlias', () => {
    it('throws an error if indices.updateAliases fails', mochaAsync(async () => {
      esClient.indices.updateAliases.rejects(new Error('Failed'));

      try {
        await helpers.updateAlias(esClient, 'feeder-enrise.nl-nl', 'enrise.nl-nl-v2', 'enrise.nl-nl-v3');
        throw new Error('expected updateAlias to fail with an error');
      } catch (err) {
        chai.expect(err).to.be.an.instanceof(Error);
        chai.expect(err.message).to.equal('Failed');
      }
    }));

    it('adds a new alias and removes the old one when a current and next alias are given', mochaAsync(async () => {
      esClient.indices.updateAliases.resolves({success: true});

      const result = await helpers.updateAlias(esClient, 'feeder-enrise.nl-nl', 'enrise.nl-nl-v2', 'enrise.nl-nl-v3');

      chai.expect(esClient.indices.updateAliases).to.be.calledWith({
        body: {
          actions: [
            {add: {index: 'enrise.nl-nl-v3', alias: 'feeder-enrise.nl-nl'}},
            {remove: {index: 'enrise.nl-nl-v2', alias: 'feeder-enrise.nl-nl'}}
          ]
        }
      });
      chai.expect(result).to.deep.equal({success: true});
    }));

    it('just adds a new alias when a only current alias is given', mochaAsync(async () => {
      esClient.indices.updateAliases.resolves({success: true});

      const result = await helpers.updateAlias(esClient, 'feeder-enrise.nl-nl', null, 'enrise.nl-nl-v3');

      chai.expect(esClient.indices.updateAliases).to.be.calledWith({
        body: {
          actions: [
            {add: {index: 'enrise.nl-nl-v3', alias: 'feeder-enrise.nl-nl'}}
          ]
        }
      });
      chai.expect(result).to.deep.equal({success: true});
    }));
  });

  describe('prepareSynonymsMapping', () => {
    let filters;
    let mapping1;
    let mapping2;

    const synonyms = {
      synonyms: ['some,synonyms'],
      preSynonyms: ['pre_some,pre_synonyms']
    };

    beforeEach(() => {
      filters = {
        synonyms: {synonyms: ['']},
        pre_synonyms: {synonyms: ['']},
        other_filter: {}
      };
      mapping1 = _.set({}, 'settings.analysis.filter', filters);
      mapping2 = _.set({}, 'settings.index.analysis.filter', filters);
    });

    it('throws an error if no filter was found on the mapping (synonyms)', () => {
      _.set(mapping1, 'settings.analysis.filter.synonyms', null);

      chai.expect(() => helpers.prepareSynonymsMapping(mapping1, synonyms))
        .to.throw('No synonyms filter found');
    });

    it('throws an error if no filter was found on the mapping (pre_synonyms)', () => {
      _.set(mapping1, 'settings.analysis.filter.pre_synonyms', null);

      chai.expect(() => helpers.prepareSynonymsMapping(mapping1, synonyms))
        .to.throw('No pre_synonyms filter found');
    });

    it('throws an error if synonyms_path was found on the filter (synonyms)', () => {
      _.set(mapping1, 'settings.analysis.filter.synonyms.synonyms_path', '../some_synonym_file.txt');

      chai.expect(() => helpers.prepareSynonymsMapping(mapping1, synonyms))
        .to.throw('synonyms_path property is not allowed on synonyms filter');
    });

    it('throws an error if synonyms_path was found on the filter (pre_synonyms)', () => {
      _.set(mapping1, 'settings.analysis.filter.pre_synonyms.synonyms_path', '../some_synonym_file.txt');

      chai.expect(() => helpers.prepareSynonymsMapping(mapping1, synonyms))
        .to.throw('synonyms_path property is not allowed on pre_synonyms filter');
    });

    it('throws an error if no synonyms property was found on the filter (synonyms)', () => {
      _.set(mapping1, 'settings.analysis.filter.synonyms.synonyms', null);

      chai.expect(() => helpers.prepareSynonymsMapping(mapping1, synonyms))
        .to.throw('No synonyms property found on synonyms filter');
    });

    it('throws an error if no synonyms property was found on the filter (pre_synonyms)', () => {
      _.set(mapping1, 'settings.analysis.filter.pre_synonyms.synonyms', null);

      chai.expect(() => helpers.prepareSynonymsMapping(mapping1, synonyms))
        .to.throw('No synonyms property found on pre_synonyms filter');
    });

    it('sets the synonyms on the mapping (mapping received from file)', () => {
      helpers.prepareSynonymsMapping(mapping1, synonyms);

      chai.expect(mapping1.settings.analysis.filter).to.deep.equal({
        synonyms: {synonyms: ['some,synonyms']},
        pre_synonyms: {synonyms: ['pre_some,pre_synonyms']},
        other_filter: {}
      });
    });

    it('sets the synonyms on the mapping (mapping received from the index)', () => {
      helpers.prepareSynonymsMapping(mapping2, synonyms);

      chai.expect(mapping2.settings.index.analysis.filter).to.deep.equal({
        synonyms: {synonyms: ['some,synonyms']},
        pre_synonyms: {synonyms: ['pre_some,pre_synonyms']},
        other_filter: {}
      });
    });

    it('leaves the synonyms untouched when no new synonyms are provided (mapping received from file)', () => {
      helpers.prepareSynonymsMapping(mapping1, {});

      chai.expect(mapping1.settings.analysis.filter).to.deep.equal({
        synonyms: {synonyms: ['']},
        pre_synonyms: {synonyms: ['']},
        other_filter: {}
      });
    });

    it('leaves the synonyms untouched when no new synonyms are provided (mapping received from the index)', () => {
      helpers.prepareSynonymsMapping(mapping2, {});

      chai.expect(mapping2.settings.index.analysis.filter).to.deep.equal({
        synonyms: {synonyms: ['']},
        pre_synonyms: {synonyms: ['']},
        other_filter: {}
      });
    });
  });
});
