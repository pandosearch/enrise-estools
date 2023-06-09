'use strict';

const _ = require('lodash');

const rMatchIndexVersion = /-v([0-9]+)$/;

function getAliasVersion(esClient, alias) {
  return esClient.indices
    .getAlias({name: alias})
    .then(res => {
      const aliases = Object.keys(res);
      if (aliases.length > 1) {
        throw new Error('Multiple aliases received');
      }

      const indexMatch = rMatchIndexVersion.exec(aliases[0]);

      return indexMatch ? parseInt(indexMatch[1], 10) : null;
    })
    .catch(err => {
      if (err.statusCode === 404) {
        return null;
      }

      throw err;
    });
}

// Retrieve a list of all versions that match this index.
async function getIndexVersions(esClient, index) {
  const result = await esClient.indices.stats({
    index: `${index}-v*`,
    metric: 'docs'
  });

  return _(result.indices)
    .keys()
    .map(i => rMatchIndexVersion.exec(i))
    .compact()
    .map(i => _.parseInt(i[1]))
    .sort((a, b) => b - a)
    .value();
}

// Retrieve mapping and only grab settings and mappings, the other info
// we don't need (aliases=manual, warmers we don't use)
// Scrubs those settings that elasticsearch does not accept as input when creating a new index
function getMapping(esClient, index) {
  return esClient.indices.get({index})
    .then(indexInfo => ({
      settings: indexInfo[index].settings,
      mappings: indexInfo[index].mappings
    }))
    .then(mapping => {
      delete mapping.settings.index.creation_date;
      delete mapping.settings.index.uuid;
      delete mapping.settings.index.provided_name;
      delete mapping.settings.index.version;
      return mapping;
    });
}

function createIndex(esClient, targetIndex, mapping) {
  return esClient.indices.create({
    index: targetIndex,
    body: mapping
  });
}

function deleteIndex(esClient, targetIndex) {
  return esClient.indices.delete({
    index: targetIndex
  });
}

function updateAlias(esClient, alias, currFeederIndex, nextFeederIndex) {
  const actions = [{add: {index: nextFeederIndex, alias}}];

  if (currFeederIndex) {
    actions.push({remove: {index: currFeederIndex, alias}});
  }

  return esClient.indices.updateAliases({
    body: {actions}
  });
}

function prepareSynonymsMapping(mapping, synonyms) {

  // If the mapping was retrieved from elasticsearch, the path is slightly different from the mapping in the file.
  const filters = _.get(mapping, 'settings.index.analysis.filter', _.get(mapping, 'settings.analysis.filter', {}));

  prepareSynonymFilter(filters, 'synonyms', synonyms.synonyms);
  preparePreSynonymsFilters(filters, synonyms.preSynonyms);
}

function preparePreSynonymsFilters(filters, preSynonyms) {
  const preSynonymsTargets = _.filter(['pre_synonyms', 'pre_synonyms_search', 'pre_synonyms_index'],
    property => _.has(filters, property));
  if (_.isEmpty(preSynonymsTargets)) {
    throw new Error('No pre_synonyms, pre_synonyms_search or pre_synonyms_index filter found');
  }
  _.each(preSynonymsTargets, target => prepareSynonymFilter(filters, target, preSynonyms));
}

function prepareSynonymFilter(filters, name, synonyms) {
  const filter = filters[name];

  if (!filter) { throw new Error(`No ${name} filter found`); }
  if (filter.synonyms_path) { throw new Error(`synonyms_path property is not allowed on ${name} filter`); }
  if (!filter.synonyms) { throw new Error(`No synonyms property found on ${name} filter`); }

  filter.synonyms = synonyms || filter.synonyms;
}

module.exports = {
  getAliasVersion,
  getIndexVersions,
  getMapping,
  createIndex,
  deleteIndex,
  updateAlias,
  prepareSynonymsMapping
};
