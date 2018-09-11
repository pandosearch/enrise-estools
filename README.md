# estooling
Elasticsearch tooling functions for managing indices and aliases. This can be used within an elasticsearch environment where a seperate index needs to be managed next to the live index. The script works by creating two aliases: a feeder-alias and a search-alias. Both are managed seperately. The former is used to fill an index and is set using the upgrade function. And the search-alias is set using the switch function.

# API Documentation
```
const estools = require('enrise-estooling');
```

### `upgrade` | Upgrade a feeder- alias
Creates a new versioned index according to the mapping, and points the feeder- alias to it.

```
estools.upgrade(esClient, index, options);

@param1: elasticsearch client
@param2: string | index to upgrade
@param2: options-object:
  - index: string | index to use
  - currentVersion: integer | existing version number, by default uses the $prefix $index version
  - targetVersion: integer | new version number, by default uses the highest $index version + 1
  - prefix: string, default:'feeder-' | prefix for feeder index
  - mapping: object, default:current feeder-mapping | mapping to use for the new index
  - synonyms: object | synonyms to use for the new index, will overwrite synonyms and pre_synonyms in the mapping with inline synonyms
  - useExistingSynonyms: boolean | uses the existing feeder-synonyms for the new index
```

### `helpers.getAliasVersion` -> int | Retrieve the version of an alias
```
estools.helpers.getAliasVersion(esClient, index);

@param1: elasticsearch client
@param2: string | index
```

### `helpers.getIndexVersions` -> [int] | Retrieve all versions (descending) of an index
```
estools.helpers.getIndexVersions(esClient, index);

@param1: elasticsearch client
@param2: string | index
```