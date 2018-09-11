'use strict';

const _ = require('lodash');

const rMatchIndexVersion = /-v([0-9]+)$/;

async function getAliasVersion(esClient, index) {
  return await esClient.indices
    .getAlias({name: index})
    .then(res => {
      const aliases = Object.keys(res);
      if (aliases.length > 1) {
        throw new Error('Multiple aliases recieved');
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
    metric: 'indices'
  });

  return _(result.indices)
    .keys()
    .map(i => rMatchIndexVersion.exec(i))
    .compact()
    .map(i => i[1])
    .map(_.parseInt)
    .sortBy()
    .value();
}

async function getMapping(esClient, index) {
  const indexInfo = await esClient.indices.get({index});

  // Only grab settings and mappings, the other info we don't need (aliases=manual, warmers we don't use)
  return {
    settings: indexInfo[index].settings,
    mappings: indexInfo[index].mappings
  };
}

async function createIndex(esClient, targetIndex, mapping) {
  return await esClient.indices.create({
    index: targetIndex,
    body: mapping
  });
}

async function deleteIndex(esClient, targetIndex) {
  return await esClient.indices.delete({
    index: targetIndex
  });
}

async function updateAlias(esClient, alias, currFeederIndex, nextFeederIndex) {
  const actions = [{add: {index: nextFeederIndex, alias}}];

  if (currFeederIndex) {
    actions.push({remove: {index: currFeederIndex, alias}});
  }

  return await esClient.indices.updateAliases({
    body: {actions}
  });
}

function prepareSynonymsMapping(mapping, synonyms) {
  const filters = _.get(mapping, 'settings.index.analysis.filter');

  prepareSynonymFilter(filters, 'synonyms', synonyms.synonyms);
  prepareSynonymFilter(filters, 'pre_synonyms', synonyms.preFile);
}

function prepareSynonymFilter(filters, name, synonyms) {
  const filter = filters[name];

  if (!filter) { throw new Error(`No ${name} filter found`); }
  if (filter.synonyms_path) { throw new Error(`synonyms_path property is not allowed on ${name} filter`); }
  if (!filter.synonyms) { throw new Error(`No synonyms property found on ${name} filter`); }

  filter.synonyms = synonyms;
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
