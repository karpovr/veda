// Control utilities

import veda from '../../common/veda.js';

import IndividualModel from '../../common/individual_model.js';

import Util from '../../common/util.js';

import Backend from '../../common/backend.js';

export {ftQuery, renderValue, interpolate};

/**
 * Perform full text search query
 * @param {string} prefix
 * @param {string} input
 * @param {string} sort
 * @param {Boolean} withDeleted
 * @return {Promise}
 */
function ftQuery (prefix, input, sort, withDeleted) {
  input = input ? input.trim() : '';
  let queryString = '';
  if ( input ) {
    const lines = input.split('\n').filter(Boolean);
    const lineQueries = lines.map((line) => {
      const special = line && line.indexOf('==') > 0 ? line : false;
      if (special) {
        return special;
      }
      const words = line.trim().replace(/[-*\s'"]+/g, ' ').split(' ').filter(Boolean);
      return words.map((word) => {
        return '\'*\' == \'' + word + '*\'';
      }).join(' && ');
    });
    queryString = lineQueries.filter(Boolean).join(' || ');
  }
  if (prefix) {
    queryString = queryString ? '(' + prefix + ') && (' + queryString + ')' : '(' + prefix + ')';
  }

  return incrementalSearch()
    .then((results) => {
      if (withDeleted) {
        queryString = queryString + ' && (\'v-s:deleted\' == true )';
        return incrementalSearch(results);
      } else {
        return results;
      }
    })
    .then((results) => {
      results = Util.unique( results );
      return Backend.get_individuals({
        ticket: veda.ticket,
        uris: results,
      });
    })
    .then((individuals) => Promise.all(individuals.map((individual) => new IndividualModel(individual).init())));

  /**
   * Perform full text search query incrementally
   * @param {Array} results
   * @param {string} cursor
   * @param {string} limit
   * @return {Promise}
   */
  function incrementalSearch (results = [], cursor = 0, limit = 100) {
    const sortSuffix = (veda.user.getLanguage()[0] ? '_' + veda.user.getLanguage()[0].toLowerCase() : '');
    return Backend.query({
      ticket: veda.ticket,
      query: queryString,
      sort: sort ? sort : "'rdfs:label" + sortSuffix + "' asc",
      from: cursor,
      top: 10,
      limit: 1000,
    }).then((queryResult) => {
      results = results.concat(queryResult.result);
      const resultCursor = queryResult.cursor;
      const resultEstimated = queryResult.estimated;
      if (results.length >= limit || resultCursor >= resultEstimated) {
        return Promise.resolve(results);
      } else {
        return Promise.resolve(incrementalSearch(results, resultCursor, limit));
      }
    });
  }
}

/**
 * Render option value
 * @param {IndividualModel|string|number|Boolean|Date} value
 * @param {string} template
 * @return {Promise<string>}
 */
function renderValue (value, template) {
  if (value instanceof IndividualModel) {
    return value.load().then(() => {
      if (template) {
        return Promise.resolve(interpolate(template, value));
      } else {
        return Promise.resolve(value.toString());
      }
    });
  } else {
    return Promise.resolve(Util.formatValue(value));
  }
}

/**
 * Interpolate string for rendering
 * @param {string} template
 * @param {IndividualModel} individual
 * @return {Promise}
 */
function interpolate (template, individual) {
  const promises = [];
  const re_interpolate = /{\s*(.*?)\s*}/g;
  const re_evaluate = /{{\s*(.*?)\s*}}/g;
  template.replace(re_evaluate, (match, group) => {
    const rendered = eval(group);
    promises.push(rendered);
    return '';
  }).replace(re_interpolate, (match, group) => {
    const properties = group.split('.');
    let target = properties.shift();
    if (target === '@') {
      target = individual;
    } else {
      target = new IndividualModel(target);
    }
    const rendered = target.getChainValue(...properties).then((values) => values.map(Util.formatValue).filter(Boolean).join(' '));
    promises.push(rendered);
    return '';
  });
  return Promise.all(promises).then((fulfilled) => {
    return template.replace(re_evaluate, () => fulfilled.shift()).replace(re_interpolate, () => fulfilled.shift());
  });
}
