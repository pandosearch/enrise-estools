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
//   - synonyms: object | synonyms to use for the new index, will overwrite synonyms and pre_synonyms in the mapping with inline synonyms
//   - useExistingSynonyms: boolean | uses the existing feeder-synonyms for the new index
module.exports = async function (esClient, index, options) {
  options = _.merge({prefix: 'feeder-'}, options);

  // Set the current feeder- version if it isn't set yet.
  if (!options.currentVersion) {
    options.currentVersion = await helpers.getAliasVersion(esClient, `${options.prefix}${index}`);
  } else { /* Should we validate that the option.currentVersion is equal to the feeder- version? */ }

  // Set the target feeder- version if it isn't set yet.
  if (!options.targetVersion) {
    const indexVersion = await helpers.getIndexVersions(esClient, index)[0];

    options.targetVersion = indexVersion ? indexVersion + 1 : null;
  } else { /* Should we validate that the option.targetVersion is higher than the highest index version? */ }

  // Guard against no versions being available.
  if (!options.currentVersion || !options.targetVersion) {
    throw new Error('No existing index found.');
  }

  const currFeederAlias = `${index}-v${options.currentVersion}`;
  const nextFeederAlias = `${index}-v${options.targetVersion}`;

  // Always retrieve the existing feeder- mapping if no mapping was given.
  if (!options.mapping) {
    options.mapping = await helpers.getMapping(esClient, currFeederAlias);
  }

  if (!options.mapping) {
    throw new Error('No mapping found.');
  }

  // Grab the feeder- synonyms if the existing feeder- version is 1 or more.
  if (!options.synonyms && options.useExistingSynonyms && options.currentVersion >= 1) {
    const feederMapping = await helpers.getMapping(esClient, currFeederAlias);
    const filters = _.get(feederMapping, 'settings.index.analysis.filter', {});
    const synonyms = _.get(filters, 'synonyms.synonyms');
    const preFile = _.get(filters, 'pre_synonyms.synonyms');

    if (synonyms || preFile) {
      options.synonyms = {synonyms, preFile};
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