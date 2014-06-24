String.prototype.language = "NONE";

// Document Model

"use strict";

function IndividualModel(veda, params) {
	var self = riot.observable(this);
	var uri = params[0];

	// Define Model functions
	var individual = {};
	var properties = {};
	var values = {};
	self.properties = {};

	self.load = function(uri) {
		individual = veda.cache[uri] ? JSON.parse( veda.cache[uri] ) : get_individual(veda.ticket, uri);
		for (var property_uri in individual) {
			(function(property_uri) {
				
				properties[property_uri] = undefined;
				values[property_uri] = undefined;

				Object.defineProperty(self, property_uri, {
					get: function() { 
						if (property_uri == "@") return individual["@"];
						if (values[property_uri]) return values[property_uri];
						values[property_uri] = individual[property_uri].map(function(value) {
							switch (value.type) {
								case "String" : 
									var string = new String(value.data);
									string.language = value.lang;
									return string; 
									break
								case "Uri" : 
									if (value.data.search(/^.{3,5}:\/\//) == 0) return new String(value.data);
									try { return new IndividualModel(veda, [value.data]); } 
									catch (e) { return new String(value.data); }
									break
								case "Datetime" : return Date(Number(value.data)); break
								case "Integer" : return Number(value.data); break
								case "Float" : return Number(value.data); break
								case "Boolean" : return Boolean(value.data); break
								default : throw ("Unsupported type of property value"); break
							}
						});
						return values[property_uri];
					},
					set: function(value) { 
						if (values[property_uri] == value) return;
						values[property_uri] = value;
						self.trigger("value:changed", property_uri, values[property_uri]);
					}
				});

				Object.defineProperty(self.properties, property_uri, {
					get: function() { 
						if (properties[property_uri]) return properties[property_uri];
						try { properties[property_uri] = new IndividualModel(veda, [property_uri]); } 
						catch (e) { properties[property_uri] = property_uri; }
						return properties[property_uri];
					},
					set: function(value) { 
						if (properties[property_uri] == value) return; 
						properties[property_uri] = value; 
						self.trigger("property:changed", property_uri, properties[property_uri]);
					}
				});
			})(property_uri);
		}
		self.trigger("individual:loaded");
	};

	self.save = function() {
		for (var property_uri in values) {
			individual[property_uri] = values[property_uri].map( function(value) {
				var result = {};
				switch (typeof value) {
					case "string" : 
						result.type = "String";
						result.data = value;
						result.lang = "NONE";
						return result;
						break
					case "number" : 
						result.type = Number.isInteger(value) ? "Integer" : "Float";
						result.data = value;
						return result;
						break
					case "boolean" : 
						result.type = "Boolean";
						result.data = value;
						return result;
						break
					default: 
						if (value instanceof Date) { return; }
						if (value instanceof String) { return; }
				}
			});
		}
		
		put_individual(veda.ticket, individual, function(data) {
		});
	};

	// Load data 
	if (uri) self.load(uri); 
	
};
