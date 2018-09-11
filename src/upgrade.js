'use strict';

const _ = require('lodash');
const helpers = require('./helpers');

// @param1: elasticsearch client
// @param2: string | index to upgrade
// @param2: options-object:
//   - index: string | index to use
//   - currentVersion: integer | existing version number, by default uses the $prefix $index version
//   - targetVersion: integer | new version number, by default uses the highest $index version + 1
//   - prefix: string, default:'feeder-' | prefix for feeder index
//   - mapping: object, default:current feeder-mapping | mapping to use for the new index
//   - synonyms: object | synonyms to use for the new index, will overwrite synonyms and pre_synonyms in the mapping with inline synonyms.
//   - useExistingSynonyms: boolean | uses the existing feeder-synonyms for the new index
//   - createTargetVersion: boolean | 
module.exports = async function (esClient, index, options) {
  options = _.merge({prefix: 'feeder-'}, options);

  if (!options.currentVersion) {
    options.currentVersion = await helpers.getAliasVersion(esClient, `${options.prefix}${index}`);
  } else { /* Should we validate that the option.currentVersion is equal to the feeder- version? */ }

  if (!options.targetVersion) {
    const indexVersions = await helpers.getIndexVersions(esClient, index);

    options.targetVersion = indexVersions[0] ? indexVersions[0] + 1 : null;
  } else { /* Should we validate that the option.targetVersion is higher than the highest index version? */ }

  if (!options.currentVersion || !options.targetVersion) {
    throw new Error('No existing index found.');
  }

  const currFeederAlias = `${index}-v${options.currentVersion}`;
  const nextFeederAlias = `${index}-v${options.targetVersion}`;

  if (!options.mapping) {
    options.mapping = await helpers.getMapping(esClient, currFeederAlias);
  }

  // TODO: Grab the feeder- synonyms.
  if (!options.synonyms && options.useExistingSynonyms) {}

  if (options.synonyms) {
    helpers.prepareSynonymsMapping(mapping, synonyms);
  }

  await helpers.createIndex(esClient, nextFeederAlias, mapping);

  // Update the alias. If it fails, delete the index previously made and re-throw the error.
  try {
    await helpers.updateAlias(esClient, `${options.prefix}${index}`, currFeederAlias, nextFeederAlias);
  } catch (updateErr) {
    await helpers.deleteIndex(esClient, nextFeederAlias);

    throw updateErr;
  }
};