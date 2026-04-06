import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const YAML_CONFIG_FILENAME = 'config.yaml';

type ConfigValue = string | number | boolean | null | ConfigMap | ConfigValue[];
type ConfigMap = { [key: string]: ConfigValue };

function loadYaml(filename: string): ConfigMap {
  const configPath = join(process.cwd(), 'config', filename);
  try {
    const loaded = yaml.load(readFileSync(configPath, 'utf8'));
    return loaded !== null && typeof loaded === 'object' && !Array.isArray(loaded)
      ? (loaded as ConfigMap)
      : {};
  } catch {
    return {};
  }
}

function deepMerge(base: ConfigMap, override: ConfigMap): ConfigMap {
  const result: ConfigMap = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    const baseVal = base[key];
    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal as ConfigMap, overrideVal as ConfigMap);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

export default (): ConfigMap => {
  const base = loadYaml(YAML_CONFIG_FILENAME);

  const env = process.env.NODE_ENV;
  if (env === 'production') return deepMerge(base, loadYaml('config.production.yaml'));
  if (env === 'test') return deepMerge(base, loadYaml('config.test.yaml'));
  return base;
};
