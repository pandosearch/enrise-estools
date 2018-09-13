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
//   - synonyms: object={synonyms: [], preSynonyms: []} | synonyms to use for the new index, will overwrite
//                       the filters synonyms and pre_synonyms in the mapping with inline synonyms
//   - useExistingSynonyms: boolean | uses the existing feeder-synonyms for the new index
module.exports = async function (esClient, index, options) {
  options = _.merge({prefix: 'feeder-'}, options);

  // Set the current feeder- version if it isn't set yet.
  if (!options.currentVersion) {
    options.currentVersion = await helpers.getAliasVersion(esClient, `${options.prefix}${index}`);
  }

  if (!options.currentVersion && !options.mapping) {
    throw new Error('Mapping must be provided, if there is no existing feeder- alias to retrieve the mapping from.');
  }

  // Set the target feeder- version if it isn't set yet.
  if (!options.targetVersion) {
    const indexVersion = (await helpers.getIndexVersions(esClient, index))[0];

    options.targetVersion = indexVersion ? indexVersion + 1 : 1;
  }

  const currFeederAlias = options.currentVersion ? `${index}-v${options.currentVersion}` : null;
  const nextFeederAlias = `${index}-v${options.targetVersion}`;

  // Always retrieve the existing feeder- mapping if no mapping was given.
  if (!options.mapping) {
    options.mapping = await helpers.getMapping(esClient, currFeederAlias);
  }

  if (!options.mapping) {
    throw new Error('No mapping found.');
  }

  // Grab the feeder- synonyms if the existing feeder- version is 1 or more.
  if (!options.synonyms && options.useExistingSynonyms && currFeederAlias) {
    const feederMapping = await helpers.getMapping(esClient, currFeederAlias);
    const filters = _.get(feederMapping, 'settings.index.analysis.filter', {});
    const synonyms = _.get(filters, 'synonyms.synonyms');
    const preSynonyms = _.get(filters, 'pre_synonyms.synonyms');

    if (synonyms || preSynonyms) {
      options.synonyms = {synonyms, preSynonyms};
    }
  }

  // Merge the synonyms inline onto the mapping.
  if (options.synonyms) {
    helpers.prepareSynonymsMapping(options.mapping, options.synonyms);
  }

  await helpers.createIndex(esClient, nextFeederAlias, options.mapping);

  // Update the alias. If it fails, delete the index previously made and re-throw the error.
  try {
    await helpers.updateAlias(esClient, `${options.prefix}${index}`, currFeederAlias, nextFeederAlias);
  } catch (err) {
    await helpers.deleteIndex(esClient, nextFeederAlias);

    throw err;
  }

  return options;
};
