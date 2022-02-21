// Validate a property in individual against property specification

export default validate;

/**
 * Validate individual property values against property specification
 * @param {IndividualModel} individual - individual to validate
 * @param {string} property_uri - property which values are validated
 * @param {IndividualModel} spec - Property specification to validate values against
 * @return {Object} - validation result
 */
function validate (individual, property_uri, spec) {
  let result = {
    state: true,
    cause: [],
  };
  if (!spec) {
    return result;
  }
  const values = individual.get(property_uri);
  // cardinality check
  if (spec.hasValue('v-ui:minCardinality')) {
    const minCardinalityState = values.length >= spec['v-ui:minCardinality'][0];
    result.state = result.state && minCardinalityState;
    if (!minCardinalityState) {
      result.cause.push('v-ui:minCardinality');
    }
  }
  if (spec.hasValue('v-ui:maxCardinality')) {
    const maxCardinalityState = values.length <= spec['v-ui:maxCardinality'][0];
    result.state = result.state && maxCardinalityState;
    if (!maxCardinalityState) {
      result.cause.push('v-ui:maxCardinality');
    }
  }
  // check each value
  result = result && values.reduce((acc, value) => {
    // regexp check
    if (spec.hasValue('v-ui:regexp')) {
      const regexp = new RegExp(spec['v-ui:regexp'][0]);
      const regexpState = regexp.test(value.toString());
      acc.state = acc.state && regexpState;
      if (!regexpState) {
        acc.cause.push('v-ui:regexp');
      }
    }
    // range check
    switch (spec['rdf:type'][0].id) {
    case 'v-ui:DatatypePropertySpecification':
      if (spec.hasValue('v-ui:minValue')) {
        const minValueState = (value >= spec['v-ui:minValue'][0]);
        acc.state = acc.state && minValueState;
        if (!minValueState) {
          acc.cause.push('v-ui:minValue');
        }
      }
      if (spec.hasValue('v-ui:maxValue')) {
        const maxValueState = (value <= spec['v-ui:maxValue'][0]);
        acc.state = acc.state && maxValueState;
        if (!maxValueState) {
          acc.cause.push('v-ui:maxValue');
        }
      }
      if (spec.hasValue('v-ui:minLength')) {
        const minLengthState = (value.toString().length >= spec['v-ui:minLength'][0]);
        acc.state = acc.state && minLengthState;
        if (!minLengthState) {
          acc.cause.push('v-ui:minLength');
        }
      }
      if (spec.hasValue('v-ui:maxLength')) {
        const maxLengthState = (value.toString().length <= spec['v-ui:maxLength'][0]);
        acc.state = acc.state && maxLengthState;
        if (!maxLengthState) {
          acc.cause.push('v-ui:maxLength');
        }
      }
      break;
    case 'v-ui:ObjectPropertySpecification':
      break;
    }
    return acc;
  }, result);
  return result;
}
