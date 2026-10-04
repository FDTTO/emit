/*
 * Reads of the OpenAPI document and of Swagger's stored responses.
 */
import { runtime } from './state.js';

/* A path item also holds non-operation keys (`parameters`, `summary`,
   `servers`), so counting its keys would overcount. */
export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export function operationCountByTag() {
  const counts = {};
  if (!runtime.spec || !runtime.spec.paths) return counts;
  Object.keys(runtime.spec.paths).forEach(function (path) {
    const item = runtime.spec.paths[path] || {};
    HTTP_METHODS.forEach(function (method) {
      const op = item[method];
      if (!op || !op.tags) return;
      op.tags.forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
  });
  return counts;
}

export function requiredSchemes(operation) {
  const requirements = operation.security || runtime.spec.security || [];
  return requirements.length ? Object.keys(requirements[0]) : [];
}

export function jsonBody(response) {
  try {
    const body = JSON.parse(response.get('text'));
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

export function headerNumber(response, name) {
  const value = parseInt(response.headers.get(name), 10);
  return Number.isNaN(value) ? null : value;
}

/* A header of a stored response, as one string. Swagger splits header
   values on commas, so "Sat, 19 Sep 2026 12:00:00 GMT" arrives as two
   parts and is joined back. */
export function responseHeader(response, name) {
  const headers = response.get('headers');
  let value = headers && (headers.get ? headers.get(name) : headers[name]);
  if (value && typeof value.toArray === 'function') value = value.toArray();
  if (Array.isArray(value)) value = value.join(', ');
  return typeof value === 'string' && value ? value : null;
}

export function idFromUrl(template, url) {
  if (typeof url !== 'string') return null;
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const parts = template.split('{id}');
  if (parts.length !== 2 || path.indexOf(parts[0]) !== 0) return null;
  if (path.lastIndexOf(parts[1]) !== path.length - parts[1].length) return null;
  const id = path.slice(parts[0].length, path.length - parts[1].length);
  return id && id.indexOf('/') < 0 ? decodeURIComponent(id) : null;
}

export function operationFor(block) {
  const path = block.querySelector('.opblock-summary-path');
  const method = block.querySelector('.opblock-summary-method');
  const item = runtime.spec && path && runtime.spec.paths[path.getAttribute('data-path')];
  return item && method ? item[method.textContent.trim().toLowerCase()] : null;
}

export function examplesOf(response) {
  const media = response && response.content && response.content['application/json'];
  const examples = media && media.examples;
  return examples
    ? Object.keys(examples).map(function (name) {
        return { name: name, summary: examples[name].summary || name, value: examples[name].value || {} };
      })
    : [];
}

/* The models read like operations: a row each until chosen, the fields as
   rows, and the operations that use the model, each a link. Drawn from the
   spec in place of Swagger's section, which stays hidden. */
function refName(ref) {
  return typeof ref === 'string' ? ref.split('/').pop() : '';
}

/* The model a property points at, directly or as the items of an array. */
export function modelOf(property) {
  return refName(property.$ref) || (property.type === 'array' && property.items ? refName(property.items.$ref) : '');
}

function usesModel(schema, name) {
  return !!schema && (refName(schema.$ref) === name || (!!schema.items && refName(schema.items.$ref) === name));
}

export function usersOf(name) {
  const users = [];
  Object.keys(runtime.spec.paths)
    .sort()
    .forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        const operation = runtime.spec.paths[path][method];
        if (!operation || !operation.operationId) return;
        const bodies = [operation.requestBody].concat(
          Object.keys(operation.responses || {}).map(function (code) {
            return operation.responses[code];
          }),
        );
        const used = bodies.some(function (body) {
          const media = body && body.content && body.content['application/json'];
          return media && usesModel(media.schema, name);
        });
        if (used)
          users.push({
            method: method,
            path: path,
            tag: (operation.tags && operation.tags[0]) || 'default',
            id: operation.operationId,
          });
      });
    });
  return users;
}

/* The request body as the design draws it: numbered lines, Format and
   Reset on its label row, the schema one tab away, and whether it is valid
   JSON said as you type. Swagger's textarea stays the editor, so React
   keeps the value; the page adds the gutter and the tools around it. */
export function requestSchemaOf(operation) {
  const media =
    operation &&
    operation.requestBody &&
    operation.requestBody.content &&
    operation.requestBody.content['application/json'];
  const ref = media && media.schema && media.schema.$ref;
  const name = ref ? ref.split('/').pop() : null;
  return name ? { name: name, schema: runtime.spec.components.schemas[name] } : null;
}

/* Getting-started steps that name a real operation become links to it.
 * The mapping comes from the spec, never from matching prose.
 */
export function operationIndex() {
  const index = {};
  if (!runtime.spec || !runtime.spec.paths) return index;

  Object.keys(runtime.spec.paths).forEach(function (path) {
    HTTP_METHODS.forEach(function (method) {
      const operation = runtime.spec.paths[path][method];
      if (!operation || !operation.operationId) return;
      const tag = (operation.tags && operation.tags[0]) || 'default';
      index[method.toUpperCase() + ' ' + path] = { tag: tag, id: operation.operationId };
    });
  });
  return index;
}

/* Each section heading opens or closes all of its operations at once. The
   button sits inside the heading, whose own click folds the section. */
export function operationsOfTag(tag) {
  const index = operationIndex();
  return Object.keys(index)
    .filter(function (key) {
      return index[key].tag === tag;
    })
    .map(function (key) {
      return index[key].id;
    });
}

/* The description Swagger loaded, read from its store once it has: one
   source, so a page whose description failed draws nothing from it. */
export function readSpec() {
  const selectors = window.ui && window.ui.specSelectors;
  if (
    runtime.spec ||
    !selectors ||
    typeof selectors.loadingStatus !== 'function' ||
    selectors.loadingStatus() !== 'success'
  )
    return;
  const json = selectors.specJson();
  runtime.spec = json && json.toJS ? json.toJS() : null;
}
